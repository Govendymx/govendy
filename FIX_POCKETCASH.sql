-- ==============================================================================
-- BLINDAJE DE OPERACIONES DE BILLETERA (POCKETCASH) - CORREGIDO V4 (FINAL)
-- ==============================================================================
-- ESTE SCRIPT INCLUYE:
-- 1. Corrección de ENUMs faltantes ('p2p_transfer', 'subscription').
-- 2. Corrección de columna 'id' inexistente (ahora usa 'user_id').
-- 3. Corrección de errores de tipo (Casting explícito de ENUMs).
-- 4. MEJORA DE UX: Incluye Nombre/Email en el concepto de la transacción para comprobantes.
--
-- Ejecuta este script completo en el Editor SQL de Supabase.
-- ==============================================================================

-- 0. Actualizar ENUMs (Agregar valores faltantes de forma segura)
DO $$
BEGIN
    ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'p2p_transfer';
    ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS 'subscription';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Función Genérica para Créditos y Débitos Atómicos
CREATE OR REPLACE FUNCTION manage_pocket_funds(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT, -- 'credit' o 'debit'
  p_concept TEXT,
  p_ref_type TEXT,
  p_ref_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_txn_id UUID;
BEGIN
  -- VALIDACIÓN DE ENTRADA
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'El monto debe ser positivo');
  END IF;

  -- BLOQUEO DE FILA (FOR UPDATE)
  SELECT user_id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- AUTO-CREACIÓN DE WALLET (Si no existe)
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance) VALUES (p_user_id, 0)
    RETURNING user_id, balance INTO v_wallet_id, v_current_balance;
  END IF;

  -- LÓGICA DE SALDO
  IF p_type = 'debit' THEN
    IF v_current_balance < p_amount THEN
      RETURN jsonb_build_object('success', false, 'message', 'Saldo insuficiente');
    END IF;
    v_new_balance := v_current_balance - p_amount;
  ELSIF p_type = 'credit' THEN
    v_new_balance := v_current_balance + p_amount;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Tipo de operación inválido');
  END IF;

  -- ACTUALIZACIÓN ATÓMICA
  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = v_wallet_id;

  -- REGISTRO DE TRANSACCIÓN
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, concept, reference_type, reference_id, created_at
  ) VALUES (
    p_user_id, 
    p_type::wallet_transaction_type, 
    p_amount, 
    p_concept, 
    p_ref_type::wallet_reference_type, 
    p_ref_id, 
    NOW()
  ) RETURNING id INTO v_txn_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Operación exitosa',
    'new_balance', v_new_balance,
    'transaction_id', v_txn_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para Pago de Órdenes en Lote (Batch) Atómico
CREATE OR REPLACE FUNCTION pay_orders_batch_atomic(
  p_user_id UUID,
  p_orders JSONB -- Array de objetos: [{"id": "...", "amount": 100}, ...]
) RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC;
  v_total_amount NUMERIC := 0;
  v_new_balance NUMERIC;
  v_order JSONB;
  v_amount NUMERIC;
  v_order_id TEXT;
BEGIN
  -- CALCULAR TOTAL
  FOR v_order IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    v_total_amount := v_total_amount + (v_order->>'amount')::NUMERIC;
  END LOOP;

  -- BLOQUEO DE FILA
  SELECT user_id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Billetera no encontrada');
  END IF;

  -- VALIDACIÓN DE SALDO TOTAL
  IF v_current_balance < v_total_amount THEN
    RETURN jsonb_build_object('success', false, 'message', 'Saldo insuficiente para el total de órdenes');
  END IF;

  -- ACTUALIZAR SALDO
  v_new_balance := v_current_balance - v_total_amount;

  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = v_wallet_id;

  -- REGISTRAR TRANSACCIONES INDIVIDUALES
  FOR v_order IN SELECT * FROM jsonb_array_elements(p_orders)
  LOOP
    v_amount := (v_order->>'amount')::NUMERIC;
    v_order_id := v_order->>'id';
    
    INSERT INTO wallet_transactions (
      wallet_id, type, amount, concept, reference_type, reference_id, created_at
    ) VALUES (
      p_user_id, 
      'debit'::wallet_transaction_type, 
      v_amount, 
      'Pago de orden #' || left(v_order_id, 8), 
      'order'::wallet_reference_type, 
      v_order_id, 
      NOW()
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función de Transferencia P2P MEJORADA (Incluye Nombre/Email en Concepto)
CREATE OR REPLACE FUNCTION transfer_pocket_funds(
  p_sender_id UUID,
  p_recipient_card TEXT,
  p_amount NUMERIC,
  p_concept TEXT DEFAULT 'Transferencia P2P'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_balance NUMERIC;
  v_recipient_balance NUMERIC;
  v_transfer_id UUID;
  
  -- Variables para info extra
  v_sender_name TEXT;
  v_sender_email TEXT;
  v_recipient_name TEXT;
  v_recipient_email TEXT;
  
  v_sender_concept TEXT;
  v_recipient_concept TEXT;
BEGIN
  -- 1. Validar montos positivos
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'El monto debe ser mayor a 0');
  END IF;

  -- 2. Buscar destinatario
  SELECT user_id INTO v_recipient_id
  FROM wallets
  WHERE pocket_cash_number = p_recipient_card;

  IF v_recipient_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Destinatario no encontrado. Verifica el ID de 16 dígitos.');
  END IF;

  -- 3. Evitar auto-envío
  IF v_recipient_id = p_sender_id THEN
    RETURN json_build_object('success', false, 'message', 'No puedes transferirte a ti mismo.');
  END IF;

  -- 4. Obtener Información de Usuarios para el Concepto
  -- Sender Info
  SELECT COALESCE(full_name, 'Usuario'), email 
  INTO v_sender_name, v_sender_email
  FROM profiles 
  WHERE id = p_sender_id;

  -- Recipient Info
  SELECT COALESCE(full_name, 'Usuario'), email 
  INTO v_recipient_name, v_recipient_email
  FROM profiles 
  WHERE id = v_recipient_id;

  -- Construir conceptos descriptivos
  v_sender_concept := 'Envío a ' || v_recipient_name || ' (' || p_recipient_card || ')';
  v_recipient_concept := 'Recibido de ' || v_sender_name || ' (ID: ' || (SELECT pocket_cash_number FROM wallets WHERE user_id = p_sender_id) || ')';

  -- 5. Verificar saldo del remitente
  SELECT balance INTO v_sender_balance
  FROM wallets
  WHERE user_id = p_sender_id
  FOR UPDATE;

  IF v_sender_balance < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Saldo insuficiente.');
  END IF;

  -- 6. Realizar Transferencia
  
  -- Descontar al remitente
  UPDATE wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE user_id = p_sender_id;

  -- Abonar al destinatario
  UPDATE wallets
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = v_recipient_id;

  -- 7. Registrar Transacciones
  v_transfer_id := gen_random_uuid();

  -- Débito para remitente
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, concept, reference_type, reference_id, created_at
  )
  VALUES (
    p_sender_id, 
    'debit'::wallet_transaction_type, 
    p_amount, 
    v_sender_concept, -- "Envío a Juan Perez..."
    'p2p_transfer'::wallet_reference_type, 
    v_transfer_id::text, 
    NOW()
  );

  -- Crédito para destinatario
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, concept, reference_type, reference_id, created_at
  )
  VALUES (
    v_recipient_id, 
    'credit'::wallet_transaction_type, 
    p_amount, 
    v_recipient_concept, -- "Recibido de Pedro Lopez..."
    'p2p_transfer'::wallet_reference_type, 
    v_transfer_id::text, 
    NOW()
  );

  RETURN json_build_object(
    'success', true, 
    'message', 'Transferencia exitosa', 
    'new_balance', v_sender_balance - p_amount,
    'recipient_name', v_recipient_name
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'message', 'Error interno: ' || SQLERRM);
END;
$$;
