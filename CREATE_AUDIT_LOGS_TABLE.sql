
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
  entity_type TEXT,
  entity_id TEXT,
  message TEXT,
  details JSONB,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  resolved_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow admin to read/write (assuming admin uses service role or specific policies)
-- For simplicity in this "admin-only" context, we might rely on service_role, 
-- but let's add a policy for authenticated admins if needed.
-- (Skipping specific policies for now as we use supabaseAdmin in API)
