
const BACKEND_URL = 'https://unelegant-flavia-treacly.ngrok-free.dev/webhook/sheet-sync';

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

    const toSend      = [];
    const hashUpdates = [];
    const idUpdates   = [];

    data.forEach((row, idx) => {
        if (!row[COL.CELULAR] && !row[COL.NOMBRE]) return;

        let contactId = row[COL.CONTACT_ID];
        if (!contactId) {
            // Prefijo con nombre de hoja para evitar colisiones entre meses
            const slug = nombreHoja.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            contactId = `sheet_${slug}_${Date.now()}_${idx + 2}`;
            idUpdates.push({ rowIdx: idx + 2, contactId });
            row[COL.CONTACT_ID] = contactId;
        }

        const payload = {
            contact_id:       String(contactId),
            fecha:            row[COL.FECHA] instanceof Date
                                ? row[COL.FECHA].toISOString()
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
        };

        const hash = md5_(JSON.stringify(payload));
        if (hash !== row[COL.HASH]) {
            toSend.push(payload);
            hashUpdates.push({ rowIdx: idx + 2, hash });
        }
    });

    idUpdates.forEach(u => {
        sheet.getRange(u.rowIdx, COL.CONTACT_ID + 1).setValue(u.contactId);
    });

    if (!toSend.length) {
        Logger.log(`[sheet-sync] "${nombreHoja}": nada que sincronizar`);
        return { processed: 0, inserted: 0, updated: 0, errors: 0 };
    }

    const resp = UrlFetchApp.fetch(BACKEND_URL, {
        method:             'post',
        contentType:        'application/json',
        headers:            { 'x-webhook-token': getToken_() },
        payload:            JSON.stringify({ leads: toSend }),
        muteHttpExceptions: true,
    });

    if (resp.getResponseCode() !== 200) {
        Logger.log(`[sheet-sync] "${nombreHoja}" Error backend ${resp.getResponseCode()}: ${resp.getContentText()}`);
        return { processed: toSend.length, inserted: 0, updated: 0, errors: toSend.length };
    }

    const body = JSON.parse(resp.getContentText());
    Logger.log(`[sheet-sync] "${nombreHoja}" OK processed=${body.processed} inserted=${body.inserted} updated=${body.updated} errors=${(body.errors || []).length}`);

    hashUpdates.forEach(u => {
        sheet.getRange(u.rowIdx, COL.HASH + 1).setValue(u.hash);
    });

    return {
        processed: body.processed || 0,
        inserted:  body.inserted  || 0,
        updated:   body.updated   || 0,
        errors:    (body.errors || []).length,
    };
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
