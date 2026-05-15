-- ============================================
-- LIMPIAR: Notificaciones Duplicadas
-- Ejecuta esto en Supabase → SQL Editor
-- Elimina notificaciones duplicadas manteniendo solo la más reciente
-- ============================================

-- Ver cuántas notificaciones duplicadas hay
SELECT 
  'DUPLICADOS ENCONTRADOS' as tipo,
  COUNT(*) as total_duplicados
FROM (
  SELECT 
    user_id,
    type,
    data->>'questionId' as question_id,
    COUNT(*) as duplicados
  FROM public.notifications
  WHERE type IN ('listing_question', 'listing_answer')
     OR (data->>'kind') IN ('listing_question', 'listing_answer')
  GROUP BY user_id, type, data->>'questionId'
  HAVING COUNT(*) > 1
) dups;

-- Eliminar duplicados, manteniendo solo la más reciente de cada grupo
-- (Basado en user_id, type, y questionId)
DELETE FROM public.notifications
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          user_id, 
          type, 
          (data->>'questionId')
        ORDER BY created_at DESC
      ) as rn
    FROM public.notifications
    WHERE type IN ('listing_question', 'listing_answer')
       OR (data->>'kind') IN ('listing_question', 'listing_answer')
  ) ranked
  WHERE rn > 1
);

-- Verificar resultado
SELECT 
  'RESULTADO' as tipo,
  COUNT(*) as notificaciones_restantes,
  COUNT(DISTINCT (user_id, type, data->>'questionId')) as grupos_unicos
FROM public.notifications
WHERE type IN ('listing_question', 'listing_answer')
   OR (data->>'kind') IN ('listing_question', 'listing_answer');
