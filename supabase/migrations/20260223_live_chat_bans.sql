-- live_chat_bans: moderación de usuarios en lives
-- Aplica a TODOS los lives (globalmente, no por sesión)
CREATE TABLE IF NOT EXISTS live_chat_bans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    moderator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID,  -- nullable: null = global ban, set = session-specific
    action TEXT NOT NULL CHECK (action IN ('mute', 'ban')),
    reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_live_chat_bans_user_active ON live_chat_bans(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_live_chat_bans_action ON live_chat_bans(action, is_active);

-- RLS: solo admins pueden leer/escribir
ALTER TABLE live_chat_bans ENABLE ROW LEVEL SECURITY;

-- Permitir lectura con service_role (API routes)
CREATE POLICY "Service role full access" ON live_chat_bans
    FOR ALL USING (true) WITH CHECK (true);
