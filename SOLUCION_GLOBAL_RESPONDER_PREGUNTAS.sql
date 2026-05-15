-- ============================================
-- SOLUCIÓN GLOBAL: Responder Preguntas para TODOS los Usuarios
-- Ejecuta este SQL en Supabase → SQL Editor
-- Esto garantiza que TODOS los vendedores puedan responder preguntas
-- ============================================

-- ============================================
-- PASO 1: Crear/Actualizar función SQL que bypass RLS
-- ============================================
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

-- ============================================
-- PASO 2: Asegurar políticas RLS correctas (por si acaso)
-- ============================================
ALTER TABLE public.listing_questions ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas antiguas que puedan estar bloqueando
DROP POLICY IF EXISTS "Seller can answer listing questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Sellers can answer their questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Users can update their questions" ON public.listing_questions;
DROP POLICY IF EXISTS "Vendedores pueden responder" ON public.listing_questions;

-- Crear política PERMISIVA que funcione para TODOS los usuarios
CREATE POLICY "Seller can answer listing questions"
  ON public.listing_questions
  FOR UPDATE
  TO authenticated
  USING (
    -- Permitir si el seller_id coincide con el usuario
    seller_id = auth.uid()
    OR
    -- O si el usuario es dueño del listing (por si seller_id está vacío/incorrecto)
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_questions.listing_id
      AND l.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Misma validación para el WITH CHECK
    seller_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_questions.listing_id
      AND l.seller_id = auth.uid()
    )
  );

-- ============================================
-- PASO 3: Corregir seller_id en preguntas existentes
-- ============================================
UPDATE public.listing_questions q
SET seller_id = l.seller_id
FROM public.listings l
WHERE q.listing_id = l.id
  AND (q.seller_id IS NULL OR q.seller_id != l.seller_id)
  AND q.is_deleted = false;

-- ============================================
-- PASO 4: Verificar que todo está correcto
-- ============================================
-- Verificar función
SELECT 
  'FUNCIÓN' as tipo,
  routine_name as nombre,
  security_type as seguridad
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_question_answer';

-- Verificar políticas
SELECT 
  'POLÍTICA' as tipo,
  policyname as nombre,
  cmd as comando
FROM pg_policies
WHERE tablename = 'listing_questions'
  AND policyname LIKE '%answer%'
ORDER BY policyname;

-- ============================================
-- PASO 5: Estadísticas de preguntas
-- ============================================
SELECT 
  'ESTADÍSTICAS' as tipo,
  COUNT(*) FILTER (WHERE answer_text IS NULL OR answer_text = '') as sin_respuesta,
  COUNT(*) FILTER (WHERE answer_text IS NOT NULL AND answer_text != '') as con_respuesta,
  COUNT(*) FILTER (WHERE seller_id IS NULL) as sin_seller_id
FROM public.listing_questions
WHERE is_deleted = false;
