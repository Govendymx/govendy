-- Tabla para rastrear espectadores únicos por pestaña del navegador
-- Evita que refrescar la página infle el contador de vistas
CREATE TABLE IF NOT EXISTS live_viewers (
    session_id  UUID  NOT NULL,
    viewer_id   TEXT  NOT NULL,   -- UUID generado en sessionStorage del navegador
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (session_id, viewer_id),
    FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE
);

-- Índice para consultas rápidas por última vez visto
CREATE INDEX IF NOT EXISTS idx_live_viewers_last_seen 
    ON live_viewers(session_id, last_seen);

-- Sin RLS — acceso solo desde el service role (servidor)
ALTER TABLE live_viewers DISABLE ROW LEVEL SECURITY;
