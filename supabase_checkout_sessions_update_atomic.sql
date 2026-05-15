-- ============================================================
-- FUNCIÓN ATOMICA PARA ACTUALIZAR CHECKOUT_SESSIONS
-- Resuelve el problema de inconsistencias al actualizar
-- checkout_sessions y orders en operaciones separadas
-- ============================================================

-- Función para actualizar checkout_session de forma atómica
CREATE OR REPLACE FUNCTION public.update_checkout_session_atomic(
  p_checkout_id UUID,
  p_admin_id UUID,
  p_action TEXT, -- 'mark_paid', 'mark_unpaid', 'cancel'
  p_admin_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_next_status public.checkout_status;
  v_order_status public.order_status;
  v_order_ids UUID[];
  v_updated_count INTEGER := 0;
  v_result JSONB;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Obtener datos de la sesión
  SELECT id, buyer_id, order_ids, status, payment_method
  INTO v_session
  FROM public.checkout_sessions
  WHERE id = p_checkout_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Sesión no encontrada'
    );
  END IF;
  
  -- 2. Determinar el nuevo status
  IF p_action = 'mark_paid' THEN
    v_next_status := 'paid'::public.checkout_status;
    v_order_status := 'paid'::public.order_status;
  ELSIF p_action = 'mark_unpaid' THEN
    v_next_status := 'pending'::public.checkout_status;
    v_order_status := 'pending_payment'::public.order_status;
  ELSIF p_action = 'cancel' THEN
    v_next_status := 'cancelled'::public.checkout_status;
    v_order_status := 'cancelled'::public.order_status;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Acción inválida'
    );
  END IF;
  
  -- 3. Extraer order_ids de forma segura
  IF v_session.order_ids IS NOT NULL THEN
    -- Verificar que es un array y tiene elementos
    IF array_length(v_session.order_ids, 1) > 0 THEN
      v_order_ids := v_session.order_ids;
    ELSE
      v_order_ids := ARRAY[]::UUID[];
    END IF;
  ELSE
    v_order_ids := ARRAY[]::UUID[];
  END IF;
  
  -- 4. Actualizar checkout_sessions de forma atómica
  UPDATE public.checkout_sessions
  SET 
    status = v_next_status,
    paid_confirmed_at = CASE WHEN p_action = 'mark_paid' THEN v_now ELSE NULL END,
    paid_confirmed_by = CASE WHEN p_action = 'mark_paid' THEN p_admin_id ELSE NULL END,
    paid_confirmed_by_name = CASE WHEN p_action = 'mark_paid' THEN p_admin_name ELSE NULL END,
    updated_at = v_now
  WHERE id = p_checkout_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se pudo actualizar checkout_sessions'
    );
  END IF;
  
  -- 5. Actualizar órdenes si existen (de forma atómica)
  IF array_length(v_order_ids, 1) > 0 THEN
    -- Actualizar órdenes y obtener el número de filas actualizadas
    UPDATE public.orders
    SET 
      status = v_order_status,
      updated_at = v_now
    WHERE id = ANY(v_order_ids);
    
    -- Obtener el número de filas actualizadas usando GET DIAGNOSTICS
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- Si la acción es mark_paid, intentar actualizar paid_at (puede no existir)
    IF p_action = 'mark_paid' THEN
      BEGIN
        UPDATE public.orders
        SET paid_at = v_now
        WHERE id = ANY(v_order_ids);
      EXCEPTION WHEN OTHERS THEN
        -- Ignorar error si la columna no existe
        NULL;
      END;
    END IF;
    
    -- Verificar si todas las órdenes fueron actualizadas
    IF v_updated_count < array_length(v_order_ids, 1) THEN
      -- REVERTIR CAMBIOS SI FALLÓ LA ACTUALIZACIÓN DE ÓRDENES
      -- Nota: No podemos hacer ROLLBACK dentro de una función PL/PGSQL llamada por RPC si hay otras transacciones
      -- Pero podemos revertir manualmente lo que acabamos de hacer
      
      UPDATE public.checkout_sessions
      SET 
        status = v_session.status,
        paid_confirmed_at = NULL,
        paid_confirmed_by = NULL,
        paid_confirmed_by_name = NULL,
        updated_at = v_now
      WHERE id = p_checkout_id;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Solo se actualizaron %s de %s órdenes. Cambios revertidos.', v_updated_count, array_length(v_order_ids, 1))
      );
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Actualización exitosa',
    'orders_updated', v_updated_count
  );
EXCEPTION WHEN OTHERS THEN
  -- En caso de error inesperado, intentar revertir
  BEGIN
    UPDATE public.checkout_sessions
    SET 
      status = v_session.status,
      paid_confirmed_at = NULL,
      paid_confirmed_by = NULL,
      paid_confirmed_by_name = NULL,
      updated_at = v_now
    WHERE id = p_checkout_id;
  EXCEPTION WHEN OTHERS THEN
    -- Si falla la reversión, no podemos hacer mucho más
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
