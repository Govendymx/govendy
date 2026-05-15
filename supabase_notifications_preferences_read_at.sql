-- Preferencias de notificaciones por usuario (PROMPT_SISTEMA_NOTIFICACIONES_COMPLETO)
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_types JSONB NOT NULL DEFAULT '{}',
  auto_delete_days INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_notification_preferences_user_id_idx
  ON user_notification_preferences(user_id);

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own preferences" ON user_notification_preferences;
CREATE POLICY "Users can manage own preferences"
  ON user_notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- read_at en notifications (para borrado diferido)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Función para limpiar notificaciones leídas antiguas
CREATE OR REPLACE FUNCTION cleanup_old_read_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications
  WHERE is_read = true
    AND read_at IS NOT NULL
    AND read_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
