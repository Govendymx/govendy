-- Add broadcast_mode and stream_key columns to live_sessions
-- broadcast_mode: 'browser' (WebRTC via LiveKit) or 'obs' (RTMP -> HLS via MediaMTX)
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS broadcast_mode text DEFAULT 'browser';
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS stream_key text;
