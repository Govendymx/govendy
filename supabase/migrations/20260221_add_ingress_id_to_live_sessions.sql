-- Add ingress_id column to live_sessions for OBS integration
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS ingress_id TEXT;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_live_sessions_ingress_id ON live_sessions(ingress_id);
