-- Migration: Add allow_t1_override to profiles
-- This column allows admins to manually enable T1 Premium shipping for Basic plan users.
-- T1 Envíos is normally restricted to Pro and Platinum plans only.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS allow_t1_override BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.allow_t1_override IS
  'Admin override: allows Basic plan users access to T1 GoPocket Premium shipping (Pro/Platinum exclusive feature).';
