
const BACKEND_URL = 'https://unelegant-flavia-treacly.ngrok-free.dev/webhook/sheet-sync';
const BATCH_SIZE  = 25;  // leads por request — para no concentrar bandwidth en un solo pico
const MAX_LEADS   = 15;  // tope de leads a sincronizar por corrida (los más recientes por FECHA)

const EXPECTED_HEADER = [
    'FECHA',
    'NOMBRE Y APELLIDO',
    'CELULAR',
    'REQUERIMIENTO',
    'CANAL',
    'CAMPAÑA',
    'TIPO',
    'ASESOR ASIGNADO',
    'OBSERVACIONES',
    'VENTA',
];

const COL = {
    FECHA:         0,
    NOMBRE:        1,
    CELULAR:       2,
    REQUERIMIENTO: 3,
    CANAL:         4,
    CAMPANA:       5,
    TIPO:          6,
    ASESOR:        7,
    OBSERVACIONES: 8,
    VENTA:         9,
    CONTACT_ID:   10,
    HASH:         11,
};

function getToken_() {
    const t = PropertiesService.getScriptProperties().getProperty('WEBHOOK_TOKEN');
    if (!t) throw new Error('Falta WEBHOOK_TOKEN en Script Properties');
    return t;
}

function norm_(s) {
    return String(s || '').trim().toUpperCase();
}

function esHojaDeLeads_(sheet) {
    const lastCol = Math.max(sheet.getLastColumn(), EXPECTED_HEADER.length);
    if (lastCol < EXPECTED_HEADER.length) return false;
    const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    return EXPECTED_HEADER.every((h, i) => norm_(header[i]) === norm_(h));
}

function asegurarColumnasControl_(sheet) {
    // Garantiza que existan los headers CONTACT_ID y _HASH_SYNC en columnas 11 y 12.
    const headerRange = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 12));
    const header = headerRange.getValues()[0];
    if (norm_(header[COL.CONTACT_ID]) !== 'CONTACT_ID') {
        sheet.getRange(1, COL.CONTACT_ID + 1).setValue('CONTACT_ID');
    }
    if (norm_(header[COL.HASH]) !== '_HASH_SYNC') {
        sheet.getRange(1, COL.HASH + 1).setValue('_HASH_SYNC');
    }
}

function syncToBackend() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojas = ss.getSheets().filter(esHojaDeLeads_);

    if (!hojas.length) {
        Logger.log('[sheet-sync] No se encontraron hojas con el header esperado');
        return;
    }

    const totales = { processed: 0, inserted: 0, updated: 0, errors: 0, hojas: 0 };

    hojas.forEach(sheet => {
        try {
            const r = syncHoja_(sheet);
            totales.processed += r.processed;
            totales.inserted  += r.inserted;
            totales.updated   += r.updated;
            totales.errors    += r.errors;
            totales.hojas++;
        } catch (err) {
            Logger.log(`[sheet-sync] Error hoja "${sheet.getName()}": ${err.message}`);
            totales.errors++;
        }
    });

    Logger.log(`[sheet-sync] TOTAL hojas=${totales.hojas} processed=${totales.processed} inserted=${totales.inserted} updated=${totales.updated} errors=${totales.errors}`);
}

function syncHoja_(sheet) {
    const nombreHoja = sheet.getName();
    asegurarColumnasControl_(sheet);

    const data = sheet.getDataRange().getValues();
    data.shift(); // header

    // Cada pendiente: { payload, hash, rowIdx, fechaTs }
    // Se acumulan todos los que difieren del hash y luego se ordenan por fecha desc
    // y se cortan a MAX_LEADS para mandar solo los más recientes.
    const pendientes = [];
    const idUpdates  = [];

    const rowByContactId = {}; // map para reconciliar la respuesta del backend

    data.forEach((row, idx) => {
        if (!row[COL.CELULAR] && !row[COL.NOMBRE]) return;

        // Importante: si la columna CONTACT_ID está vacía, NO generamos uno aquí.
        // El backend intentará matchear por celular contra leads existentes de SendPulse
        // y devolverá el contact_id real. Solo generamos un placeholder si tampoco
        // hay celular para que el backend pueda procesarlo.
        let contactId = row[COL.CONTACT_ID];
        if (!contactId && !row[COL.CELULAR]) {
            const slug = nombreHoja.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            contactId = `sheet_${slug}_${Date.now()}_${idx + 2}`;
            idUpdates.push({ rowIdx: idx + 2, contactId });
            row[COL.CONTACT_ID] = contactId;
        }

        const payload = compactar_({
            contact_id:       contactId ? String(contactId) : '',
            fecha:            row[COL.FECHA] instanceof Date
                                ? Utilities.formatDate(row[COL.FECHA], 'America/Lima', 'yyyy-MM-dd')
                                : row[COL.FECHA],
            nombre:           row[COL.NOMBRE],
            celular:          row[COL.CELULAR] ? String(row[COL.CELULAR]) : null,
            requerimiento:    row[COL.REQUERIMIENTO],
            canal:            row[COL.CANAL],
            campana:          row[COL.CAMPANA],
            tipo:             row[COL.TIPO],
            asesor_asignado:  row[COL.ASESOR],
            observaciones:    row[COL.OBSERVACIONES],
            venta:            row[COL.VENTA],
        });

        const hash = md5_(JSON.stringify(payload));
        if (hash !== row[COL.HASH]) {
            // Calcular timestamp de fecha para poder ordenar por reciente
            let fechaTs = 0;
            const fRaw = row[COL.FECHA];
            if (fRaw instanceof Date) fechaTs = fRaw.getTime();
            else if (fRaw)            fechaTs = new Date(fRaw).getTime() || 0;

            pendientes.push({ payload, hash, rowIdx: idx + 2, fechaTs });
            // Tracking para reconciliar respuesta: usamos celular como llave secundaria
            const cel = row[COL.CELULAR] ? String(row[COL.CELULAR]) : null;
            const key = (payload.contact_id || '') + '|' + (cel || '');
            rowByContactId[key] = idx + 2;
        }
    });

    idUpdates.forEach(u => {
        sheet.getRange(u.rowIdx, COL.CONTACT_ID + 1).setValue(u.contactId);
    });

    if (!pendientes.length) {
        Logger.log(`[sheet-sync] "${nombreHoja}": nada que sincronizar`);
        return { processed: 0, inserted: 0, updated: 0, errors: 0 };
    }

    // Ordenar por fecha desc (más recientes primero) y cortar a MAX_LEADS
    pendientes.sort((a, b) => b.fechaTs - a.fechaTs);
    const totalDetectados = pendientes.length;
    const seleccionados   = pendientes.slice(0, MAX_LEADS);
    if (totalDetectados > MAX_LEADS) {
        Logger.log(`[sheet-sync] "${nombreHoja}": ${totalDetectados} pendientes detectados, sincronizando solo los ${MAX_LEADS} más recientes (resto en próxima corrida)`);
    }

    // Reconstruir arrays paralelos a partir de los seleccionados
    const toSend           = seleccionados.map(p => p.payload);
    const rowIdxByLeadIdx  = seleccionados.map(p => p.rowIdx);
    const hashIndex        = {};
    seleccionados.forEach(p => { hashIndex[p.rowIdx] = p.hash; });

    const totales = { processed: 0, inserted: 0, updated: 0, errors: 0 };

    for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
        const lote = toSend.slice(i, i + BATCH_SIZE);
        const lotePayload = JSON.stringify({ leads: lote });

        const resp = UrlFetchApp.fetch(BACKEND_URL, {
            method:             'post',
            contentType:        'application/json',
            headers:            { 'x-webhook-token': getToken_() },
            payload:            lotePayload,
            muteHttpExceptions: true,
        });

        if (resp.getResponseCode() !== 200) {
            Logger.log(`[sheet-sync] "${nombreHoja}" lote ${i / BATCH_SIZE + 1} ERROR ${resp.getResponseCode()}: ${resp.getContentText().slice(0, 200)}`);
            totales.errors += lote.length;
            // Si fallo de bandwidth/red, mejor abortar para no malgastar más cuota
            if (resp.getResponseCode() === 429 || resp.getContentText().toLowerCase().indexOf('bandwidth') >= 0) {
                Logger.log(`[sheet-sync] "${nombreHoja}" abortando: cuota agotada`);
                break;
            }
            continue; // intenta el siguiente lote
        }

        const body = JSON.parse(resp.getContentText());
        totales.processed += body.processed || 0;
        totales.inserted  += body.inserted  || 0;
        totales.updated   += body.updated   || 0;
        totales.errors    += (body.errors || []).length;

        // Reconciliar contact_ids del lote
        (body.results || []).forEach(r => {
            if (!r.changed && r.input_contact_id) return;
            const key = (r.input_contact_id || '') + '|' + (r.celular || '');
            const rowIdx = rowByContactId[key];
            if (rowIdx) {
                sheet.getRange(rowIdx, COL.CONTACT_ID + 1).setValue(r.contact_id);
            }
        });

        // Persistir hashes solo de las filas del lote confirmado
        for (let k = 0; k < lote.length; k++) {
            const rowIdx = rowIdxByLeadIdx[i + k];
            if (rowIdx && hashIndex[rowIdx]) {
                sheet.getRange(rowIdx, COL.HASH + 1).setValue(hashIndex[rowIdx]);
            }
        }

        Logger.log(`[sheet-sync] "${nombreHoja}" lote ${i / BATCH_SIZE + 1} OK (${lote.length} leads, bytes=${lotePayload.length})`);
    }

    Logger.log(`[sheet-sync] "${nombreHoja}" TOTAL processed=${totales.processed} inserted=${totales.inserted} updated=${totales.updated} errors=${totales.errors}`);
    return totales;
}

// Quita campos null/undefined/'' del payload — reduce bytes en el wire significativamente
function compactar_(obj) {
    const out = {};
    Object.keys(obj).forEach(k => {
        const v = obj[k];
        if (v === null || v === undefined) return;
        if (typeof v === 'string' && v.trim() === '') return;
        out[k] = v;
    });
    return out;
}

function instalarTrigger() {
    ScriptApp.getProjectTriggers()
        .filter(t => t.getHandlerFunction() === 'syncToBackend')
        .forEach(t => ScriptApp.deleteTrigger(t));

    ScriptApp.newTrigger('syncToBackend').timeBased().everyHours(8).create();
    Logger.log('Trigger 8h instalado para syncToBackend');
}

function md5_(str) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, str);
    return bytes
        .map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'))
        .join('');
}
