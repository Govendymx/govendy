-- Pocket App - Reviews públicos (comentarios) para reputación (idempotente)
-- Permite mostrar comentarios en perfiles públicos SIN abrir RLS de `user_ratings`.
-- Ejecuta en Supabase → SQL Editor.

-- Eliminar la función existente si tiene un tipo de retorno diferente
DROP FUNCTION IF EXISTS public.get_user_reviews_public(UUID, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_user_reviews_public(
  p_user UUID,
  p_direction TEXT DEFAULT NULL, -- 'buyer_to_seller' | 'seller_to_buyer' | NULL
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  direction TEXT,
  stars INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ,
  rater_name TEXT,
  rater_id UUID
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ur.direction,
    ur.stars,
    ur.comment,
    ur.created_at,
    COALESCE(NULLIF(split_part(p.full_name, ' ', 1), ''), 'Usuario') AS rater_name,
    ur.rater_id
  FROM public.user_ratings ur
  LEFT JOIN public.profiles p ON p.id = ur.rater_id
  WHERE
    ur.ratee_id = p_user
    AND (p_direction IS NULL OR p_direction = '' OR ur.direction = p_direction)
    AND COALESCE(ur.comment, '') <> ''
  ORDER BY ur.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 10), 50));
$$;

GRANT EXECUTE ON FUNCTION public.get_user_reviews_public(UUID, TEXT, INTEGER) TO anon, authenticated;

