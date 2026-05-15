-- ============================================
-- FUNCIÓN SQL PARA ACTUALIZAR RESPUESTAS (BYPASS RLS)
-- Ejecuta esto en Supabase → SQL Editor
-- ============================================
-- Esta función permite actualizar respuestas sin problemas de RLS

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
  v_result JSONB;
BEGIN
  -- Verificar que la pregunta existe y obtener seller_id
  SELECT seller_id, listing_id INTO v_seller_id, v_listing_id
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
  
  -- Verificar que el usuario es el vendedor
  IF v_seller_id IS NULL OR v_seller_id != p_user_id THEN
    -- Verificar por listing como fallback
    IF v_listing_id IS NOT NULL THEN
      SELECT seller_id INTO v_seller_id
      FROM public.listings
      WHERE id = v_listing_id
        AND seller_id = p_user_id;
      
      IF v_seller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
      END IF;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;
  END IF;
  
  -- Verificar que la pregunta no esté ya respondida
  IF EXISTS (
    SELECT 1 FROM public.listing_questions
    WHERE id = p_question_id
      AND answer_text IS NOT NULL
      AND answer_text != ''
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pregunta ya respondida');
  END IF;
  
  -- Actualizar la respuesta
  UPDATE public.listing_questions
  SET 
    answer_text = p_answer_text,
    answered_at = NOW()
  WHERE id = p_question_id;
  
  -- Verificar que se actualizó correctamente
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se pudo actualizar');
  END IF;
  
  -- Retornar éxito
  RETURN jsonb_build_object(
    'success', true,
    'question_id', p_question_id,
    'answered_at', NOW()
  );
  
EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- VERIFICAR QUE LA FUNCIÓN SE CREÓ CORRECTAMENTE
-- ============================================
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'update_question_answer';
