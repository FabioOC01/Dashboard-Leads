BEGIN;

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
  ROUND(AVG(EXTRACT(EPOCH FROM (l.ts_primera_respuesta - l.ts_efectivo)) / 60)
    FILTER (WHERE l.ts_primera_respuesta IS NOT NULL AND l.ts_efectivo IS NOT NULL)) AS avg_min_primera_respuesta,
  ROUND(AVG(EXTRACT(EPOCH FROM (l.ts_cotizacion_enviada - l.ts_primera_respuesta)) / 60)
    FILTER (WHERE l.ts_cotizacion_enviada IS NOT NULL AND l.ts_primera_respuesta IS NOT NULL)) AS avg_min_cotizacion
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
  ROUND(AVG(EXTRACT(EPOCH FROM (l.ts_cotizacion_tecnico - l.ts_derivado)) / 60)
    FILTER (WHERE l.ts_derivado IS NOT NULL AND l.ts_cotizacion_tecnico IS NOT NULL)) AS avg_min_soporte_cotizacion,
  ROUND(AVG(EXTRACT(EPOCH FROM (l.ts_cierre - l.ts_derivado)) / 60)
    FILTER (WHERE l.ts_derivado IS NOT NULL AND l.ts_cierre IS NOT NULL
      AND l.estado IN ('venta_efectiva', 'no_efectiva'))) AS avg_min_soporte_final
FROM vendedores v
LEFT JOIN leads l ON l.tecnico_id = v.id
WHERE v.activo = true AND v.rol = 'tecnico'
GROUP BY v.id, v.nombre;

CREATE INDEX IF NOT EXISTS idx_leads_vendedor ON leads(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_leads_tecnico ON leads(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado);
CREATE INDEX IF NOT EXISTS idx_leads_ts_efectivo ON leads(ts_efectivo);
CREATE INDEX IF NOT EXISTS idx_leads_ts_lead_creado ON leads(ts_lead_creado);

COMMIT;
