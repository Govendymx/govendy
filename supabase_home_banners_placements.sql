-- Pocket - Home banners: placement + fit/position (idempotente)
-- Ejecuta en Supabase → SQL Editor.

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS placement TEXT NOT NULL DEFAULT 'hero';

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS image_fit TEXT NOT NULL DEFAULT 'cover';

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS image_position TEXT NOT NULL DEFAULT 'center';

-- PRO (floating): frecuencia, posición y delay (idempotente)
ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS floating_frequency TEXT NOT NULL DEFAULT '7d';

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS floating_position TEXT NOT NULL DEFAULT 'bottom_right';

ALTER TABLE public.home_banners
  ADD COLUMN IF NOT EXISTS floating_delay_ms INTEGER NOT NULL DEFAULT 0;

-- Valores recomendados:
-- placement: 'hero' | 'top' | 'mid' | 'mid2' | 'mid3' | 'bottom' | 'floating'
-- image_fit: 'cover' | 'contain'
-- image_position: 'center' | 'top' | 'bottom' | 'left' | 'right'
-- floating_frequency: 'session' | '24h' | '7d'
-- floating_position: 'bottom_right' | 'bottom_left' | 'top_right' | 'top_left'
-- floating_delay_ms: 0..600000 (ej: 1500)

