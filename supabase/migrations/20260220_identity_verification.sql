-- Add identity verification columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS selfie_ine_url text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS verification_rejection_reason text,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz;

-- Migrate existing verified users: if is_verified = true AND ine_front_url is set, mark as approved
UPDATE profiles
SET verification_status = 'approved'
WHERE is_verified = true
  AND ine_front_url IS NOT NULL
  AND verification_status = 'none';

-- Migrate users who submitted INE but aren't verified yet: mark as pending
UPDATE profiles
SET verification_status = 'pending',
    verification_submitted_at = COALESCE(updated_at, now())
WHERE is_verified = false
  AND ine_front_url IS NOT NULL
  AND ine_front_url != ''
  AND verification_status = 'none';
