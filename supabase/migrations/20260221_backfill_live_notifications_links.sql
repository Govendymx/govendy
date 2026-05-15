-- Backfill de enlaces para notificaciones de EN VIVO
-- Convierte notificaciones antiguas "live_started" sin link_to
-- en notificaciones que apuntan a la sala correcta (/live/{session_id})

UPDATE notifications
SET link_to = '/live/' || (data->>'session_id')
WHERE link_to IS NULL
  AND (
    type = 'admin_announcement'
    OR type IS NULL
  )
  AND data->>'kind' = 'live_started'
  AND data->>'session_id' IS NOT NULL;

