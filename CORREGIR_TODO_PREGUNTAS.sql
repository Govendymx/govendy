-- ============================================
-- CORRECCIÓN COMPLETA: Sistema de Preguntas
-- Ejecuta esto en Supabase → SQL Editor
-- Esto corrige todos los problemas conocidos
-- ============================================

-- PASO 1: Limpiar answered_at incorrecto (preguntas con answered_at pero sin answer_text)
UPDATE public.listing_questions
SET answered_at = NULL
WHERE is_deleted = false
  AND answered_at IS NOT NULL
  AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '');

-- PASO 2: Establecer answered_at para preguntas con answer_text pero sin answered_at
UPDATE public.listing_questions
SET answered_at = COALESCE(answered_at, NOW())
WHERE is_deleted = false
  AND answer_text IS NOT NULL
  AND answer_text != ''
  AND TRIM(answer_text) != ''
  AND answered_at IS NULL;

-- PASO 3: Corregir seller_id en preguntas que tienen listing_id pero no seller_id
UPDATE public.listing_questions q
SET seller_id = l.seller_id
FROM public.listings l
WHERE q.listing_id = l.id
  AND q.is_deleted = false
  AND (q.seller_id IS NULL OR q.seller_id != l.seller_id);

-- PASO 4: Verificar y actualizar la función update_question_answer
-- (Esto se hace en SOLUCION_GLOBAL_RESPONDER_PREGUNTAS.sql, pero lo incluimos aquí por si acaso)
CREATE OR REPLACE FUNCTION public.update_question_answer(
  p_question_id UUID,
  p_answer_text TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id UUID;
  v_listing_id UUID;
  v_current_answer TEXT;
  v_rows_updated INTEGER;
  v_verified_answer TEXT;
  v_verified_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verificar que la pregunta existe y obtener seller_id
  SELECT seller_id, listing_id, answer_text INTO v_seller_id, v_listing_id, v_current_answer
  FROM public.listing_questions
  WHERE id = p_question_id
    AND is_deleted = false;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pregunta no encontrada');
  END IF;
  
  -- Si seller_id está vacío, obtenerlo del listing
  IF v_seller_id IS NULL AND v_listing_id IS NOT NULL THEN
    SELECT seller_id INTO v_seller_id
    FROM public.listings
    WHERE id = v_listing_id;
    
    -- Actualizar seller_id en la pregunta
    IF v_seller_id IS NOT NULL THEN
      UPDATE public.listing_questions
      SET seller_id = v_seller_id
      WHERE id = p_question_id;
    END IF;
  END IF;
  
  -- Verificar que el usuario es el vendedor (por seller_id o por listing)
  IF v_seller_id IS NULL OR v_seller_id != p_user_id THEN
    -- Verificar por listing como fallback
    IF v_listing_id IS NOT NULL THEN
      SELECT seller_id INTO v_seller_id
      FROM public.listings
      WHERE id = v_listing_id
        AND seller_id = p_user_id;
      
      IF v_seller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado. Solo el vendedor puede responder.');
      END IF;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'No autorizado. No se pudo verificar el vendedor.');
    END IF;
  END IF;
  
  -- Verificar que la pregunta no esté ya respondida (solo si tiene contenido válido)
  IF v_current_answer IS NOT NULL AND v_current_answer != '' AND TRIM(v_current_answer) != '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pregunta ya respondida');
  END IF;
  
  -- CRÍTICO: Verificar que p_answer_text no esté vacío
  IF p_answer_text IS NULL OR p_answer_text = '' OR TRIM(p_answer_text) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La respuesta no puede estar vacía');
  END IF;
  
  -- Actualizar la respuesta (bypass RLS completamente)
  -- IMPORTANTE: Asegurar que answer_text y answered_at se guarden correctamente
  UPDATE public.listing_questions
  SET 
    answer_text = TRIM(p_answer_text),  -- Asegurar que no tenga espacios al inicio/final
    answered_at = NOW()
  WHERE id = p_question_id
    AND is_deleted = false;
  
  -- Verificar cuántas filas se actualizaron
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  -- Verificar que se actualizó al menos una fila
  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se pudo actualizar la pregunta (ninguna fila afectada). Verifica que la pregunta existe y no está eliminada.');
  END IF;
  
  -- Esperar un momento para que la BD procese el UPDATE (evitar problemas de caché)
  PERFORM pg_sleep(0.1);
  
  -- Verificar una vez más que realmente se guardó consultando la BD
  SELECT answer_text, answered_at INTO v_verified_answer, v_verified_at
  FROM public.listing_questions
  WHERE id = p_question_id
    AND is_deleted = false;
  
  -- Verificar que answer_text se guardó correctamente
  IF v_verified_answer IS NULL OR v_verified_answer = '' OR TRIM(v_verified_answer) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La respuesta no se guardó correctamente (answer_text está vacío después de guardar)');
  END IF;
  
  -- Verificar que el contenido coincide (ignorando espacios al inicio/final)
  IF TRIM(v_verified_answer) != TRIM(p_answer_text) THEN
    RETURN jsonb_build_object('success', false, 'error', 'La respuesta no se guardó correctamente (el contenido no coincide)');
  END IF;
  
  -- Verificar que answered_at se guardó
  IF v_verified_at IS NULL THEN
    -- Intentar actualizar answered_at si no se guardó
    UPDATE public.listing_questions
    SET answered_at = NOW()
    WHERE id = p_question_id;
    
    -- Re-verificar
    SELECT answered_at INTO v_verified_at
    FROM public.listing_questions
    WHERE id = p_question_id;
    
    IF v_verified_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'answered_at no se guardó correctamente después de múltiples intentos');
    END IF;
  END IF;
  
  -- Retornar éxito con información completa
  RETURN jsonb_build_object(
    'success', true,
    'question_id', p_question_id,
    'answered_at', v_verified_at,
    'message', 'Respuesta guardada correctamente',
    'rows_updated', v_rows_updated
  );
  
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- PASO 5: Verificar que todo está correcto
SELECT 
  'VERIFICACIÓN FINAL' as tipo,
  COUNT(*) FILTER (WHERE is_deleted = false AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '') AND answered_at IS NULL) as sin_respuesta_correcta,
  COUNT(*) FILTER (WHERE is_deleted = false AND answer_text IS NOT NULL AND answer_text != '' AND TRIM(answer_text) != '' AND answered_at IS NOT NULL) as con_respuesta_correcta,
  COUNT(*) FILTER (WHERE is_deleted = false AND (answer_text IS NULL OR answer_text = '') AND answered_at IS NOT NULL) as datos_corruptos_answered_at,
  COUNT(*) FILTER (WHERE is_deleted = false AND answer_text IS NOT NULL AND answer_text != '' AND answered_at IS NULL) as datos_corruptos_answer_text
FROM public.listing_questions;
