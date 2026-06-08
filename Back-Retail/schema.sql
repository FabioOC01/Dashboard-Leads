-- =============================================
-- VENDEDORES
-- =============================================
CREATE TABLE vendedores (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  email       VARCHAR(100),
  whatsapp    VARCHAR(20),
  activo      BOOLEAN DEFAULT true,
  creado_en   TIMESTAMP DEFAULT NOW(),
  foto_url    TEXT
);

-- =============================================
-- FERIADOS PERÚ (excluidos del cálculo)
-- =============================================
CREATE TABLE feriados (
  fecha DATE PRIMARY KEY,
  descripcion VARCHAR(100)
);

INSERT INTO feriados (fecha, descripcion) VALUES
  ('2025-01-01', 'Año Nuevo'),
  ('2025-04-17', 'Jueves Santo'),
  ('2025-04-18', 'Viernes Santo'),
  ('2025-05-01', 'Día del Trabajo'),
  ('2025-06-07', 'Batalla de Arica'),
  ('2025-06-29', 'San Pedro y San Pablo'),
  ('2025-07-28', 'Fiestas Patrias'),
  ('2025-07-29', 'Fiestas Patrias'),
  ('2025-08-30', 'Santa Rosa de Lima'),
  ('2025-10-08', 'Combate de Angamos'),
  ('2025-11-01', 'Todos los Santos'),
  ('2025-12-08', 'Inmaculada Concepción'),
  ('2025-12-25', 'Navidad'),
  ('2026-01-01', 'Año Nuevo'),
  ('2026-04-02', 'Jueves Santo'),
  ('2026-04-03', 'Viernes Santo'),
  ('2026-05-01', 'Día del Trabajo'),
  ('2026-06-07', 'Batalla de Arica'),
  ('2026-06-29', 'San Pedro y San Pablo'),
  ('2026-07-28', 'Fiestas Patrias'),
  ('2026-07-29', 'Fiestas Patrias'),
  ('2026-08-30', 'Santa Rosa de Lima'),
  ('2026-10-08', 'Combate de Angamos'),
  ('2026-11-01', 'Todos los Santos'),
  ('2026-12-08', 'Inmaculada Concepción'),
  ('2026-12-25', 'Navidad');

-- =============================================
-- FUNCIÓN: siguiente momento hábil
-- Si el timestamp cae fuera de horario, 
-- lo mueve a la apertura del sig. día hábil
-- =============================================
CREATE OR REPLACE FUNCTION siguiente_momento_habil(ts TIMESTAMP)
RETURNS TIMESTAMP AS $$
DECLARE
  resultado   TIMESTAMP := ts;
  dia_semana  INT;        -- 0=domingo, 6=sábado
  hora_actual TIME;
  apertura    TIME;
  cierre      TIME;
BEGIN
  LOOP
    dia_semana  := EXTRACT(DOW FROM resultado);
    hora_actual := resultado::TIME;

    -- Domingo: saltar al lunes 9:30
    IF dia_semana = 0 THEN
      resultado := date_trunc('day', resultado) + INTERVAL '1 day' + TIME '09:30';
      CONTINUE;
    END IF;

    -- Sábado: horario 9:30-14:00
    IF dia_semana = 6 THEN
      apertura := TIME '09:30';
      cierre   := TIME '14:00';
      IF hora_actual < apertura THEN
        resultado := date_trunc('day', resultado) + apertura;
        EXIT;
      ELSIF hora_actual > cierre THEN
        -- Después del sábado → lunes 9:30
        resultado := date_trunc('day', resultado) + INTERVAL '2 days' + TIME '09:30';
        CONTINUE;
      ELSE
        EXIT; -- dentro de horario sábado
      END IF;
    END IF;

    -- Lunes a viernes: horario 9:30-18:30
    apertura := TIME '09:30';
    cierre   := TIME '18:30';

    -- Verificar si es feriado
    IF EXISTS (SELECT 1 FROM feriados WHERE fecha = resultado::DATE) THEN
      resultado := date_trunc('day', resultado) + INTERVAL '1 day' + TIME '09:30';
      CONTINUE;
    END IF;

    IF hora_actual < apertura THEN
      resultado := date_trunc('day', resultado) + apertura;
      EXIT;
    ELSIF hora_actual > cierre THEN
      resultado := date_trunc('day', resultado) + INTERVAL '1 day' + TIME '09:30';
      CONTINUE;
    ELSE
      EXIT; -- dentro de horario L-V
    END IF;
  END LOOP;

  RETURN resultado;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FUNCIÓN: minutos hábiles entre dos timestamps
-- =============================================
CREATE OR REPLACE FUNCTION business_minutes(inicio TIMESTAMP, fin TIMESTAMP)
RETURNS INTEGER AS $$
DECLARE
  cursor      TIMESTAMP := siguiente_momento_habil(inicio);
  total       INTEGER   := 0;
  dia_semana  INT;
  cierre_dia  TIME;
  fin_habil   TIMESTAMP;
BEGIN
  IF fin IS NULL OR fin <= inicio THEN RETURN 0; END IF;

  WHILE cursor < fin LOOP
    dia_semana := EXTRACT(DOW FROM cursor);

    -- Saltar domingo
    IF dia_semana = 0 THEN
      cursor := date_trunc('day', cursor) + INTERVAL '1 day' + TIME '09:30';
      CONTINUE;
    END IF;

    -- Saltar feriados
    IF EXISTS (SELECT 1 FROM feriados WHERE fecha = cursor::DATE) THEN
      cursor := date_trunc('day', cursor) + INTERVAL '1 day' + TIME '09:30';
      CONTINUE;
    END IF;

    -- Cierre según día
    IF dia_semana = 6 THEN
      cierre_dia := TIME '14:00';
    ELSE
      cierre_dia := TIME '18:30';
    END IF;

    fin_habil := date_trunc('day', cursor) + cierre_dia;

    IF fin < fin_habil THEN
      total := total + EXTRACT(EPOCH FROM (fin - cursor))::INTEGER / 60;
      cursor := fin;
    ELSE
      total := total + EXTRACT(EPOCH FROM (fin_habil - cursor))::INTEGER / 60;
      cursor := date_trunc('day', cursor) + INTERVAL '1 day' + TIME '09:30';
    END IF;
  END LOOP;

  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- LEADS
-- =============================================
CREATE TABLE leads (
  id                        SERIAL PRIMARY KEY,
  sendpulse_contact_id      VARCHAR(100) UNIQUE,

  -- Datos del cliente
  nombre                    VARCHAR(150),
  celular                   VARCHAR(20),
  canal                     VARCHAR(50),
  campana                   VARCHAR(100),
  requerimiento             TEXT,
  notas                     TEXT,

  -- Asignación
  vendedor_id               INTEGER REFERENCES vendedores(id),

  -- Timestamps reales
  ts_lead_creado            TIMESTAMP,
  ts_primera_respuesta      TIMESTAMP,
  ts_cotizacion_enviada     TIMESTAMP,
  ts_cierre                 TIMESTAMP,

  -- Timestamp efectivo (ajustado a horario hábil)
  ts_efectivo               TIMESTAMP,

  -- Estado y resultado
  estado    VARCHAR(30) DEFAULT 'nuevo',
  -- nuevo | en_atencion | cotizado
  -- venta_efectiva | negociacion_futuro | no_efectiva

  resultado VARCHAR(20),
  -- ganado | perdido | futuro

  -- Flag: vendedor fue notificado de inactividad
  alerta_inactividad_enviada  BOOLEAN DEFAULT false,

  creado_en TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- EVENTOS (audit trail completo)
-- =============================================
CREATE TABLE eventos_lead (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  vendedor_id INTEGER REFERENCES vendedores(id),
  tipo        VARCHAR(50),
  -- lead_creado | primera_respuesta | cotizacion_enviada
  -- marcado_venta_efectiva | marcado_negociacion_futuro
  -- marcado_no_efectiva | alerta_inactividad
  metadata    JSONB,
  creado_en   TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX idx_leads_vendedor  ON leads(vendedor_id);
CREATE INDEX idx_leads_estado    ON leads(estado);
CREATE INDEX idx_leads_ts_creado ON leads(ts_lead_creado);
CREATE INDEX idx_leads_alerta    ON leads(estado, alerta_inactividad_enviada)
  WHERE estado IN ('cotizado', 'negociacion_futuro');
CREATE INDEX idx_eventos_lead    ON eventos_lead(lead_id);

-- =============================================
-- VISTA: métricas por vendedor (útil al dashboard)
-- =============================================
CREATE VIEW metricas_vendedor AS
SELECT
  v.id,
  v.nombre,
  COUNT(l.id) FILTER (WHERE l.estado NOT IN ('no_efectiva'))        AS leads_activos,
  COUNT(l.id) FILTER (WHERE l.estado = 'venta_efectiva')            AS ventas_efectivas,
  COUNT(l.id) FILTER (WHERE l.estado = 'no_efectiva')               AS no_efectivas,
  COUNT(l.id) FILTER (WHERE l.estado = 'negociacion_futuro')        AS en_seguimiento,
  ROUND(AVG(
    business_minutes(l.ts_efectivo, l.ts_primera_respuesta)
  ) FILTER (WHERE l.ts_primera_respuesta IS NOT NULL))               AS avg_min_primera_respuesta,
  ROUND(AVG(
    business_minutes(l.ts_primera_respuesta, l.ts_cotizacion_enviada)
  ) FILTER (WHERE l.ts_cotizacion_enviada IS NOT NULL))              AS avg_min_cotizacion
FROM vendedores v
LEFT JOIN leads l ON l.vendedor_id = v.id
WHERE v.activo = true
GROUP BY v.id, v.nombre;