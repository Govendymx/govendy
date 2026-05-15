-- GoPocket TV: Platform-owned live channel
-- Adds is_platform flag to live_sessions and creates platform_videos table for auto-loop content

-- 1. Add platform flag to live_sessions
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS is_platform boolean DEFAULT false;

-- 2. Table for pre-recorded promotional videos (loop when OBS is offline)
CREATE TABLE IF NOT EXISTS platform_videos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    video_url text NOT NULL,
    thumbnail_url text,
    duration_seconds integer DEFAULT 0,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE platform_videos ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can see the videos)
CREATE POLICY "platform_videos_public_read" ON platform_videos
    FOR SELECT USING (true);

-- Only service_role can insert/update/delete (via admin API)
