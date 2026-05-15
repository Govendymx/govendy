-- Run this in Supabase SQL Editor to add egress columns
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS egress_id TEXT;
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS egress_hls_url TEXT;
