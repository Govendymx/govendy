-- Pocket - Calificaciones (1-10) por orden + reputación agregada (idempotente)
-- Ejecuta este SQL en Supabase → SQL Editor.

-- Tabla: public.user_ratings
CREATE TABLE IF NOT EXISTS public.user_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, -- 'buyer_to_seller' | 'seller_to_buyer'
  stars INTEGER NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Constraints (idempotentes)
ALTER TABLE public.user_ratings
  DROP CONSTRAINT IF EXISTS user_ratings_direction_chk;
ALTER TABLE public.user_ratings
  ADD CONSTRAINT user_ratings_direction_chk
  CHECK (direction IN ('buyer_to_seller', 'seller_to_buyer'));

ALTER TABLE public.user_ratings
  DROP CONSTRAINT IF EXISTS user_ratings_stars_chk;
ALTER TABLE public.user_ratings
  ADD CONSTRAINT user_ratings_stars_chk
  CHECK (stars >= 1 AND stars <= 10);

ALTER TABLE public.user_ratings
  DROP CONSTRAINT IF EXISTS user_ratings_one_per_direction;
ALTER TABLE public.user_ratings
  ADD CONSTRAINT user_ratings_one_per_direction
  UNIQUE (order_id, direction);

CREATE INDEX IF NOT EXISTS user_ratings_ratee_direction_idx ON public.user_ratings (ratee_id, direction);
CREATE INDEX IF NOT EXISTS user_ratings_order_idx ON public.user_ratings (order_id);

-- RLS
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

-- Policies (re-crear v2)
DROP POLICY IF EXISTS "Participants can read own ratings (v1)" ON public.user_ratings;
DROP POLICY IF EXISTS "Participants can read own ratings (v2)" ON public.user_ratings;
DROP POLICY IF EXISTS "Admins can read all ratings (v2)" ON public.user_ratings;
DROP POLICY IF EXISTS "Buyer/Seller can create ratings (v2)" ON public.user_ratings;

CREATE POLICY "Participants can read own ratings (v2)"
  ON public.user_ratings
  FOR SELECT
  TO authenticated
  USING (
    rater_id = auth.uid()
    OR ratee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

CREATE POLICY "Buyer/Seller can create ratings (v2)"
  ON public.user_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    rater_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.id = user_ratings.order_id
          AND user_ratings.direction = 'buyer_to_seller'
          AND o.buyer_id = auth.uid()
          AND user_ratings.ratee_id = o.seller_id
      )
      OR
      EXISTS (
        SELECT 1
        FROM public.orders o
        WHERE o.id = user_ratings.order_id
          AND user_ratings.direction = 'seller_to_buyer'
          AND o.seller_id = auth.uid()
          AND user_ratings.ratee_id = o.buyer_id
      )
    )
  );

-- Función pública (solo agregados) para termómetro / badges sin exponer comentarios
CREATE OR REPLACE FUNCTION public.get_user_reputation(p_user UUID)
RETURNS TABLE (
  user_id UUID,
  seller_avg_stars NUMERIC,
  seller_count BIGINT,
  seller_percent INTEGER,
  seller_badge TEXT,
  buyer_avg_stars NUMERIC,
  buyer_count BIGINT,
  buyer_percent INTEGER,
  buyer_badge TEXT,
  overall_avg_stars NUMERIC,
  overall_count BIGINT,
  overall_percent INTEGER,
  overall_badge TEXT
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
WITH base AS (
  SELECT direction, stars
  FROM public.user_ratings
  WHERE ratee_id = p_user
),
seller AS (
  SELECT
    AVG(stars)::NUMERIC AS avg_stars,
    COUNT(*)::BIGINT AS cnt
  FROM base
  WHERE direction = 'buyer_to_seller'
),
buyer AS (
  SELECT
    AVG(stars)::NUMERIC AS avg_stars,
    COUNT(*)::BIGINT AS cnt
  FROM base
  WHERE direction = 'seller_to_buyer'
),
overall AS (
  SELECT
    AVG(stars)::NUMERIC AS avg_stars,
    COUNT(*)::BIGINT AS cnt
  FROM base
),
norm AS (
  SELECT
    COALESCE((SELECT avg_stars FROM seller), NULL) AS seller_avg,
    COALESCE((SELECT cnt FROM seller), 0) AS seller_cnt,
    COALESCE((SELECT avg_stars FROM buyer), NULL) AS buyer_avg,
    COALESCE((SELECT cnt FROM buyer), 0) AS buyer_cnt,
    COALESCE((SELECT avg_stars FROM overall), NULL) AS overall_avg,
    COALESCE((SELECT cnt FROM overall), 0) AS overall_cnt
)
SELECT
  p_user AS user_id,
  norm.seller_avg AS seller_avg_stars,
  norm.seller_cnt AS seller_count,
  CASE WHEN norm.seller_cnt > 0 THEN GREATEST(0, LEAST(100, ROUND(norm.seller_avg * 10)::INT)) ELSE 100 END AS seller_percent,
  CASE
    WHEN (CASE WHEN norm.seller_cnt > 0 THEN ROUND(norm.seller_avg * 10)::INT ELSE 100 END) >= 91 THEN 'platinum'
    WHEN (CASE WHEN norm.seller_cnt > 0 THEN ROUND(norm.seller_avg * 10)::INT ELSE 100 END) >= 71 THEN 'gold'
    WHEN (CASE WHEN norm.seller_cnt > 0 THEN ROUND(norm.seller_avg * 10)::INT ELSE 100 END) >= 51 THEN 'plata'
    ELSE NULL
  END AS seller_badge,
  norm.buyer_avg AS buyer_avg_stars,
  norm.buyer_cnt AS buyer_count,
  CASE WHEN norm.buyer_cnt > 0 THEN GREATEST(0, LEAST(100, ROUND(norm.buyer_avg * 10)::INT)) ELSE 100 END AS buyer_percent,
  CASE
    WHEN (CASE WHEN norm.buyer_cnt > 0 THEN ROUND(norm.buyer_avg * 10)::INT ELSE 100 END) >= 91 THEN 'platinum'
    WHEN (CASE WHEN norm.buyer_cnt > 0 THEN ROUND(norm.buyer_avg * 10)::INT ELSE 100 END) >= 71 THEN 'gold'
    WHEN (CASE WHEN norm.buyer_cnt > 0 THEN ROUND(norm.buyer_avg * 10)::INT ELSE 100 END) >= 51 THEN 'plata'
    ELSE NULL
  END AS buyer_badge,
  norm.overall_avg AS overall_avg_stars,
  norm.overall_cnt AS overall_count,
  CASE WHEN norm.overall_cnt > 0 THEN GREATEST(0, LEAST(100, ROUND(norm.overall_avg * 10)::INT)) ELSE 100 END AS overall_percent,
  CASE
    WHEN (CASE WHEN norm.overall_cnt > 0 THEN ROUND(norm.overall_avg * 10)::INT ELSE 100 END) >= 91 THEN 'platinum'
    WHEN (CASE WHEN norm.overall_cnt > 0 THEN ROUND(norm.overall_avg * 10)::INT ELSE 100 END) >= 71 THEN 'gold'
    WHEN (CASE WHEN norm.overall_cnt > 0 THEN ROUND(norm.overall_avg * 10)::INT ELSE 100 END) >= 51 THEN 'plata'
    ELSE NULL
  END AS overall_badge
FROM norm;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_reputation(UUID) TO anon, authenticated;

