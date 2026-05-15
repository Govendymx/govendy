-- Add missing enum values to wallet_reference_type
-- Run this in Supabase SQL Editor

ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'gift_card';
ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'payout';
ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'topup';
ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'deposit';
