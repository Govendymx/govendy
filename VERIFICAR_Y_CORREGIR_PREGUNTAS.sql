-- ============================================
-- VERIFICAR Y CORREGIR: Preguntas que no aparecen
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================

-- PASO 1: Ver preguntas sin respuesta con sus seller_id
SELECT 
  q.id,
  q.listing_id,
  q.seller_id as seller_id_en_pregunta,
  l.seller_id as seller_id_en_listing,
  CASE 
    WHEN q.seller_id IS NULL THEN '❌ NULL'
    WHEN l.seller_id IS NULL THEN '⚠️ Listing sin seller_id'
    WHEN q.seller_id = l.seller_id THEN '✅ Correcto'
    ELSE '❌ NO COINCIDE'
  END as estado,
  LEFT(q.question_text, 50) as pregunta,
  q.answer_text,
  q.created_at
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '')
ORDER BY q.created_at DESC
LIMIT 20;

-- PASO 2: Corregir seller_id en preguntas que lo tienen NULL o incorrecto
UPDATE public.listing_questions q
SET seller_id = l.seller_id
FROM public.listings l
WHERE q.listing_id = l.id
  AND l.seller_id IS NOT NULL
  AND (q.seller_id IS NULL OR q.seller_id != l.seller_id)
  AND q.is_deleted = false;

-- PASO 3: Verificar cuántas se corrigieron
SELECT 
  'CORRECCIÓN' as tipo,
  COUNT(*) as preguntas_corregidas
FROM public.listing_questions q
JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
  AND q.seller_id = l.seller_id
  AND (q.answer_text IS NULL OR q.answer_text = '');

-- PASO 4: Verificar triggers de notificaciones
SELECT 
  'TRIGGERS' as tipo,
  trigger_name as nombre,
  event_manipulation as evento,
  action_timing as cuando
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'listing_questions'
  AND trigger_name LIKE '%notify%'
ORDER BY trigger_name;

-- PASO 5: Verificar funciones de notificación
SELECT 
  'FUNCIONES' as tipo,
  routine_name as nombre,
  security_type as seguridad
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('notify_seller_on_new_question', 'notify_asker_on_question_answer')
ORDER BY routine_name;

-- PASO 6: Probar crear una notificación manualmente (para diagnóstico)
-- Descomenta y reemplaza con un seller_id real para probar:
-- SELECT public.notify_seller_on_new_question();

-- PASO 7: Ver notificaciones recientes (últimas 10)
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  created_at,
  is_read,
  data->>'listingId' as listing_id,
  data->>'questionId' as question_id
FROM public.notifications
WHERE (type IN ('listing_question', 'listing_answer')
   OR (data->>'kind') IN ('listing_question', 'listing_answer'))
ORDER BY created_at DESC
LIMIT 10;
