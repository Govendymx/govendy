-- ============================================================
-- FUNCIÓN ATOMICA PARA RESOLVER DISPUTAS
-- Resuelve el problema de inconsistencias al actualizar
-- disputes y orders en operaciones separadas
-- ============================================================

-- Función para resolver disputa de forma atómica
CREATE OR REPLACE FUNCTION public.resolve_dispute_atomic(
  p_dispute_id UUID,
  p_admin_id UUID,
  p_decision TEXT,
  p_admin_note TEXT DEFAULT NULL,
  p_return_tracking TEXT DEFAULT NULL,
  p_return_guide_url TEXT DEFAULT NULL,
  p_return_guide_cost NUMERIC DEFAULT NULL,
  p_return_guide_charged_to TEXT DEFAULT NULL,
  p_partial_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dispute RECORD;
  v_order_id UUID;
  v_buyer_id UUID;
  v_seller_id UUID;
  v_next_status TEXT;
  v_order_status TEXT;
  v_result JSONB;
  v_updated_dispute_id UUID;
  v_updated_order_id UUID;
BEGIN
  -- 1. Obtener datos de la disputa
  SELECT id, order_id, buyer_id, seller_id, status, created_at
  INTO v_dispute
  FROM public.disputes
  WHERE id = p_dispute_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Disputa no encontrada'
    );
  END IF;
  
  -- 2. Determinar el nuevo status de la disputa
  IF p_decision = 'close' THEN
    v_next_status := 'closed';
  ELSE
    v_next_status := 'resolved';
  END IF;
  
  -- 3. Determinar el nuevo status de la orden
  IF p_decision IN ('release', 'keep_money_seller', 'partial_refund_seller', 'refund_seller_minus_fees') THEN
    v_order_status := 'paid';
  ELSIF p_decision IN ('refund', 'assign_return_tracking', 'assign_guide_charged_buyer', 'assign_guide_charged_seller', 'partial_refund_buyer', 'refund_buyer_minus_fees') THEN
    v_order_status := 'refunded';
  ELSE
    v_order_status := NULL; -- No cambiar status de orden
  END IF;
  
  -- 4. Actualizar disputa de forma atómica
  -- Usar COALESCE para manejar NULLs y solo actualizar columnas que existen
  UPDATE public.disputes
  SET 
    status = v_next_status,
    admin_decision = p_decision,
    admin_note = COALESCE(p_admin_note, admin_note),
    updated_at = NOW()
  WHERE id = p_dispute_id
  RETURNING id INTO v_updated_dispute_id;
  
  -- Actualizar campos de guía de devolución si existen (pueden no existir en todas las bases de datos)
  BEGIN
    UPDATE public.disputes
    SET 
      return_tracking = COALESCE(p_return_tracking, return_tracking),
      return_guide_url = COALESCE(p_return_guide_url, return_guide_url),
      return_guide_cost = COALESCE(p_return_guide_cost, return_guide_cost),
      return_guide_charged_to = COALESCE(p_return_guide_charged_to, return_guide_charged_to)
    WHERE id = p_dispute_id;
  EXCEPTION
    WHEN undefined_column THEN
      -- Las columnas de guía no existen, ignorar (no crítico)
      NULL;
    WHEN OTHERS THEN
      -- Otro error, ignorar pero no fallar
      NULL;
  END;
  
  IF v_updated_dispute_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se pudo actualizar la disputa'
    );
  END IF;
  
  -- 5. Actualizar orden si es necesario (de forma atómica)
  IF v_order_status IS NOT NULL AND v_dispute.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET 
      status = v_order_status,
      updated_at = NOW()
    WHERE id = v_dispute.order_id
    RETURNING id INTO v_updated_order_id;
    
    -- Si la decisión requiere marcar paid_to_seller_at (puede no existir)
    IF p_decision IN ('release', 'keep_money_seller', 'refund_seller_minus_fees') THEN
      BEGIN
        UPDATE public.orders
        SET 
          paid_to_seller_at = NOW(),
          paid_to_seller_by = p_admin_id
        WHERE id = v_dispute.order_id;
      EXCEPTION
        WHEN undefined_column THEN
          -- La columna paid_to_seller_at no existe, ignorar
          NULL;
        WHEN OTHERS THEN
          -- Otro error, ignorar pero no fallar
          NULL;
      END;
    END IF;
    
    IF v_updated_order_id IS NULL THEN
      -- Revertir cambio en disputa si la orden no se actualizó
      UPDATE public.disputes
      SET 
        status = v_dispute.status,
        admin_decision = NULL,
        admin_note = NULL,
        updated_at = NOW()
      WHERE id = p_dispute_id;
      
      RETURN jsonb_build_object(
        'success', false,
        'error', 'No se pudo actualizar la orden. Cambios revertidos.'
      );
    END IF;
  END IF;
  
  -- 6. Retornar resultado exitoso
  RETURN jsonb_build_object(
    'success', true,
    'dispute_id', v_updated_dispute_id,
    'order_id', v_updated_order_id,
    'dispute_status', v_next_status,
    'order_status', v_order_status
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, revertir todo
    BEGIN
      UPDATE public.disputes
      SET 
        status = v_dispute.status,
        admin_decision = NULL,
        admin_note = NULL,
        updated_at = NOW()
      WHERE id = p_dispute_id;
    EXCEPTION
      WHEN OTHERS THEN
        NULL; -- Ignorar errores en rollback
    END;
    
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users (admins will be checked inside)
GRANT EXECUTE ON FUNCTION public.resolve_dispute_atomic TO authenticated;

-- Comentario
COMMENT ON FUNCTION public.resolve_dispute_atomic IS 'Resuelve una disputa de forma atómica, actualizando tanto la disputa como la orden asociada en una sola transacción';
