-- ============================================================
-- SCRIPT MAESTRO: INTEGRACIÓN COMPLETA DE PANELES CON ADMIN
-- Ejecuta todos los scripts SQL necesarios en orden
-- ============================================================
-- 
-- INSTRUCCIONES:
-- 1. Copia TODO este archivo
-- 2. Pégalo en Supabase SQL Editor
-- 3. Haz clic en "Run" o presiona Ctrl+Enter
-- 4. Espera a que termine (puede tardar unos segundos)
-- 5. Verifica el resultado final al final del script
--
-- ============================================================

-- ============================================================
-- PARTE 1: TABLA DE EVENTOS DE OPERACIONES
-- ============================================================
-- Crea la tabla central para tracking de todas las operaciones
-- ============================================================

-- Crear tabla de eventos de operaciones
CREATE TABLE IF NOT EXISTS public.admin_operation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'order_created', 'payment_received', 'dispute_opened', etc.
  entity_type TEXT NOT NULL, -- 'order', 'payment', 'dispute', 'listing', 'user', etc.
  entity_id TEXT NOT NULL,
  user_id TEXT, -- Usuario que realizó la acción
  admin_id TEXT, -- Admin que procesó (si aplica)
  status TEXT, -- 'pending', 'processing', 'completed', 'failed'
  metadata JSONB DEFAULT '{}'::jsonb, -- Datos adicionales del evento
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMPTZ,
  notified_admin BOOLEAN DEFAULT FALSE
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_admin_events_type ON public.admin_operation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_events_entity ON public.admin_operation_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_events_created ON public.admin_operation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_events_notified ON public.admin_operation_events(notified_admin) WHERE notified_admin = FALSE;
CREATE INDEX IF NOT EXISTS idx_admin_events_user ON public.admin_operation_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admin_events_status ON public.admin_operation_events(status) WHERE status IS NOT NULL;

-- Comentarios
COMMENT ON TABLE public.admin_operation_events IS 'Registro centralizado de todas las operaciones para tracking y notificaciones del panel de administrador';
COMMENT ON COLUMN public.admin_operation_events.event_type IS 'Tipo de evento: order_created, payment_received, dispute_opened, etc.';
COMMENT ON COLUMN public.admin_operation_events.entity_type IS 'Tipo de entidad: order, payment, dispute, listing, user, etc.';
COMMENT ON COLUMN public.admin_operation_events.entity_id IS 'ID de la entidad relacionada';
COMMENT ON COLUMN public.admin_operation_events.metadata IS 'Datos adicionales del evento en formato JSON';
COMMENT ON COLUMN public.admin_operation_events.notified_admin IS 'Indica si ya se notificó a los administradores';

-- RLS: Solo admins pueden leer eventos
ALTER TABLE public.admin_operation_events ENABLE ROW LEVEL SECURITY;

-- Política: Solo admins pueden leer eventos
DROP POLICY IF EXISTS "Admins can read operation events" ON public.admin_operation_events;
CREATE POLICY "Admins can read operation events"
  ON public.admin_operation_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Función helper para verificar si un usuario es admin (si no existe)
CREATE OR REPLACE FUNCTION public.is_admin(user_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE admin_users.user_id = user_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PARTE 2: FUNCIÓN ATOMICA PARA RESOLVER DISPUTAS
-- ============================================================
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
  UPDATE public.disputes
  SET 
    status = v_next_status,
    admin_decision = p_decision,
    admin_note = COALESCE(p_admin_note, admin_note),
    updated_at = NOW()
  WHERE id = p_dispute_id
  RETURNING id INTO v_updated_dispute_id;
  
  -- Actualizar campos de guía de devolución si existen
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
      NULL; -- Las columnas de guía no existen, ignorar
    WHEN OTHERS THEN
      NULL; -- Otro error, ignorar
  END;
  
  IF v_updated_dispute_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No se pudo actualizar la disputa'
    );
  END IF;
  
  -- 5. Actualizar orden si es necesario
  IF v_order_status IS NOT NULL AND v_dispute.order_id IS NOT NULL THEN
    UPDATE public.orders
    SET 
      status = v_order_status,
      updated_at = NOW()
    WHERE id = v_dispute.order_id
    RETURNING id INTO v_updated_order_id;
    
    -- Si la decisión requiere marcar paid_to_seller_at
    IF p_decision IN ('release', 'keep_money_seller', 'refund_seller_minus_fees') THEN
      BEGIN
        UPDATE public.orders
        SET 
          paid_to_seller_at = NOW(),
          paid_to_seller_by = p_admin_id
        WHERE id = v_dispute.order_id;
      EXCEPTION
        WHEN undefined_column THEN
          NULL; -- La columna no existe, ignorar
        WHEN OTHERS THEN
          NULL; -- Otro error, ignorar
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.resolve_dispute_atomic TO authenticated;

-- Comentario
COMMENT ON FUNCTION public.resolve_dispute_atomic IS 'Resuelve una disputa de forma atómica, actualizando tanto la disputa como la orden asociada en una sola transacción';

-- ============================================================
-- PARTE 3: FUNCIÓN ATOMICA PARA ACTUALIZAR CHECKOUT_SESSIONS
-- ============================================================
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
  v_next_status TEXT;
  v_order_status TEXT;
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
    v_next_status := 'paid';
    v_order_status := 'paid';
  ELSIF p_action = 'mark_unpaid' THEN
    v_next_status := 'pending';
    v_order_status := 'pending_payment';
  ELSIF p_action = 'cancel' THEN
    v_next_status := 'cancelled';
    v_order_status := 'cancelled';
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Acción inválida'
    );
  END IF;
  
  -- 3. Extraer order_ids de forma segura
  IF v_session.order_ids IS NOT NULL THEN
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
  
  -- 5. Actualizar órdenes si existen
  IF array_length(v_order_ids, 1) > 0 THEN
    UPDATE public.orders
    SET 
      status = v_order_status,
      updated_at = v_now
    WHERE id = ANY(v_order_ids);
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- Si la acción es mark_paid, intentar actualizar paid_at
    IF p_action = 'mark_paid' THEN
      BEGIN
        UPDATE public.orders
        SET paid_at = v_now
        WHERE id = ANY(v_order_ids);
      EXCEPTION
        WHEN undefined_column THEN
          NULL; -- La columna paid_at no existe, ignorar
        WHEN OTHERS THEN
          NULL; -- Otro error, ignorar
      END;
    END IF;
    
    -- Verificar que se actualizaron todas las órdenes
    IF v_updated_count < array_length(v_order_ids, 1) THEN
      -- Revertir cambio en checkout_sessions
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
  
  -- 6. Retornar resultado exitoso
  RETURN jsonb_build_object(
    'success', true,
    'checkout_id', p_checkout_id,
    'status', v_next_status,
    'updated_orders', v_updated_count,
    'order_ids', v_order_ids
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, revertir todo
    BEGIN
      UPDATE public.checkout_sessions
      SET 
        status = v_session.status,
        paid_confirmed_at = NULL,
        paid_confirmed_by = NULL,
        paid_confirmed_by_name = NULL,
        updated_at = v_now
      WHERE id = p_checkout_id;
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.update_checkout_session_atomic TO authenticated;

-- Comentario
COMMENT ON FUNCTION public.update_checkout_session_atomic IS 'Actualiza checkout_sessions y orders de forma atómica, asegurando consistencia de datos';

-- ============================================================
-- PARTE 4: TABLA DE LOGS DE ACCIONES ADMINISTRATIVAS
-- ============================================================
-- Sistema de auditoría para todas las acciones de administradores
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'suspend_user', 'ban_user', 'delete_user', 'approve_payment', etc.
  target_user_id UUID,
  target_entity_type TEXT, -- 'user', 'order', 'listing', etc.
  target_entity_id TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON public.admin_action_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON public.admin_action_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target ON public.admin_action_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON public.admin_action_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logs_entity ON public.admin_action_logs(target_entity_type, target_entity_id);

-- Comentarios
COMMENT ON TABLE public.admin_action_logs IS 'Logs de auditoría para todas las acciones realizadas por administradores';
COMMENT ON COLUMN public.admin_action_logs.action IS 'Tipo de acción: suspend_user, ban_user, delete_user, approve_payment, etc.';
COMMENT ON COLUMN public.admin_action_logs.target_user_id IS 'ID del usuario afectado (si aplica)';
COMMENT ON COLUMN public.admin_action_logs.target_entity_type IS 'Tipo de entidad afectada: user, order, listing, etc.';
COMMENT ON COLUMN public.admin_action_logs.metadata IS 'Datos adicionales de la acción en formato JSON';

-- RLS: Solo admins pueden leer logs
ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

-- Política: Solo admins pueden leer logs
DROP POLICY IF EXISTS "Admins can read action logs" ON public.admin_action_logs;
CREATE POLICY "Admins can read action logs"
  ON public.admin_action_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- ============================================================
-- PARTE 5: TABLA DE LOGS DE PAGOS
-- ============================================================
-- Sistema de auditoría y análisis de pagos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL,
  external_reference TEXT,
  status TEXT NOT NULL, -- 'success' | 'error'
  stage TEXT NOT NULL, -- 'validation', 'processing', 'notification', etc.
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_payment_logs_payment_id ON public.payment_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_external_ref ON public.payment_logs(external_reference);
CREATE INDEX IF NOT EXISTS idx_payment_logs_status ON public.payment_logs(status);
CREATE INDEX IF NOT EXISTS idx_payment_logs_created ON public.payment_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_logs_stage ON public.payment_logs(stage);

-- Comentarios
COMMENT ON TABLE public.payment_logs IS 'Logs de auditoría para todos los pagos procesados en el sistema';
COMMENT ON COLUMN public.payment_logs.payment_id IS 'ID del pago (MercadoPago ID o checkout ID)';
COMMENT ON COLUMN public.payment_logs.external_reference IS 'Referencia externa (checkout_id, order_id, etc.)';
COMMENT ON COLUMN public.payment_logs.stage IS 'Etapa del proceso donde ocurrió el log (validation, processing, notification, etc.)';
COMMENT ON COLUMN public.payment_logs.metadata IS 'Datos adicionales del log en formato JSON';

-- RLS: Solo admins pueden leer logs
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Política: Solo admins pueden leer logs
DROP POLICY IF EXISTS "Admins can read payment logs" ON public.payment_logs;
CREATE POLICY "Admins can read payment logs"
  ON public.payment_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users 
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- ============================================================
-- VERIFICACIÓN FINAL
-- ============================================================
-- Este query muestra el estado de todas las creaciones
-- ============================================================

SELECT 
  '✅ VERIFICACIÓN COMPLETA' as estado,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_operation_events') as tabla_eventos_creada,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'admin_operation_events') as indices_eventos_creados,
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace) as funcion_is_admin,
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'resolve_dispute_atomic' AND pronamespace = 'public'::regnamespace) as funcion_resolve_dispute,
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'update_checkout_session_atomic' AND pronamespace = 'public'::regnamespace) as funcion_update_checkout,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_action_logs') as tabla_admin_logs_creada,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'admin_action_logs') as indices_admin_logs_creados,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_logs') as tabla_payment_logs_creada,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'payment_logs') as indices_payment_logs_creados;

-- ============================================================
-- RESUMEN
-- ============================================================
-- Si todo salió bien, deberías ver:
-- - tabla_eventos_creada: 1
-- - indices_eventos_creados: 6
-- - funcion_is_admin: 1
-- - funcion_resolve_dispute: 1
-- - funcion_update_checkout: 1
-- ============================================================
