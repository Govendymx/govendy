-- ==========================================
-- SEUDÓNIMO / NICKNAME (Solo PRO y Platinum)
-- ==========================================
-- Máximo 10 caracteres. Solo se muestra si el
-- vendedor tiene plan 'pro' o 'platinum'.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname varchar(10) DEFAULT NULL;
