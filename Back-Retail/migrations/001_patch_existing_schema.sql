BEGIN;

ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS email VARCHAR(100),
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20),
  ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS creado_en TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS rol VARCHAR(30) DEFAULT 'vendedor';

UPDATE vendedores SET activo = true WHERE activo IS NULL;
UPDATE vendedores SET rol = 'vendedor' WHERE rol IS NULL;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS sendpulse_contact_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nombre VARCHAR(150),
  ADD COLUMN IF NOT EXISTS celular VARCHAR(20),
  ADD COLUMN IF NOT EXISTS canal VARCHAR(50),
  ADD COLUMN IF NOT EXISTS campana VARCHAR(100),
  ADD COLUMN IF NOT EXISTS requerimiento TEXT,
  ADD COLUMN IF NOT EXISTS notas TEXT,
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(100),
  ADD COLUMN IF NOT EXISTS observaciones TEXT,
  ADD COLUMN IF NOT EXISTS vendedor_id INTEGER REFERENCES vendedores(id),
  ADD COLUMN IF NOT EXISTS tecnico_id INTEGER REFERENCES vendedores(id),
  ADD COLUMN IF NOT EXISTS ts_lead_creado TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ts_primera_respuesta TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ts_cotizacion_enviada TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ts_derivado TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ts_cotizacion_tecnico TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ts_cierre TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ts_efectivo TIMESTAMP,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(30) DEFAULT 'nuevo',
  ADD COLUMN IF NOT EXISTS resultado VARCHAR(20),
  ADD COLUMN IF NOT EXISTS alerta_inactividad_enviada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS creado_en TIMESTAMP DEFAULT NOW();

UPDATE leads SET estado = 'nuevo' WHERE estado IS NULL;
UPDATE leads SET alerta_inactividad_enviada = false WHERE alerta_inactividad_enviada IS NULL;
UPDATE leads SET ts_lead_creado = COALESCE(ts_lead_creado, creado_en, NOW()) WHERE ts_lead_creado IS NULL;
UPDATE leads SET ts_efectivo = COALESCE(ts_efectivo, ts_lead_creado, creado_en, NOW()) WHERE ts_efectivo IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_sendpulse_contact_id
  ON leads(sendpulse_contact_id)
  WHERE sendpulse_contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_vendedor ON leads(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_leads_tecnico ON leads(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado);
CREATE INDEX IF NOT EXISTS idx_leads_ts_creado ON leads(ts_lead_creado);

CREATE OR REPLACE FUNCTION momento_habil_vigente(ts TIMESTAMP)
RETURNS TIMESTAMP AS $$
  SELECT siguiente_momento_habil($1);
$$ LANGUAGE sql STABLE;

DROP VIEW IF EXISTS metricas_tecnico;
DROP VIEW IF EXISTS metricas_vendedor;

CREATE VIEW metricas_vendedor AS
SELECT
  v.id,
  v.nombre,
  COUNT(l.id) FILTER (WHERE l.estado NOT IN ('no_efectiva')) AS leads_activos,
  COUNT(l.id) FILTER (WHERE l.estado = 'venta_efectiva') AS ventas_efectivas,
  COUNT(l.id) FILTER (WHERE l.estado = 'no_efectiva') AS no_efectivas,
  COUNT(l.id) FILTER (WHERE l.estado = 'negociacion_futuro') AS en_seguimiento,
  ROUND(AVG(
    business_minutes(l.ts_efectivo, l.ts_primera_respuesta)
  ) FILTER (WHERE l.ts_primera_respuesta IS NOT NULL)) AS avg_min_primera_respuesta,
  ROUND(AVG(
    business_minutes(l.ts_primera_respuesta, l.ts_cotizacion_enviada)
  ) FILTER (WHERE l.ts_cotizacion_enviada IS NOT NULL)) AS avg_min_cotizacion
FROM vendedores v
LEFT JOIN leads l ON l.vendedor_id = v.id
WHERE v.activo = true
GROUP BY v.id, v.nombre;

CREATE VIEW metricas_tecnico AS
SELECT
  v.id,
  v.nombre,
  COUNT(l.id) AS leads_atendidos,
  COUNT(l.id) FILTER (WHERE l.estado = 'derivado') AS derivados_abiertos,
  COUNT(l.id) FILTER (WHERE l.estado = 'venta_efectiva') AS ventas_efectivas,
  COUNT(l.id) FILTER (WHERE l.estado = 'no_efectiva') AS no_efectivas,
  ROUND(AVG(
    business_minutes(l.ts_derivado, l.ts_cotizacion_tecnico)
  ) FILTER (WHERE l.ts_derivado IS NOT NULL AND l.ts_cotizacion_tecnico IS NOT NULL)) AS avg_min_soporte_cotizacion,
  ROUND(AVG(
    business_minutes(l.ts_derivado, l.ts_cierre)
  ) FILTER (WHERE l.ts_derivado IS NOT NULL AND l.ts_cierre IS NOT NULL
            AND l.estado IN ('venta_efectiva', 'no_efectiva'))) AS avg_min_soporte_final
FROM vendedores v
LEFT JOIN leads l ON l.tecnico_id = v.id
WHERE v.activo = true AND v.rol = 'tecnico'
GROUP BY v.id, v.nombre;

COMMIT;
