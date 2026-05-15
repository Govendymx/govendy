-- ==============================================================================
-- BLINDAJE DE OPERACIONES DE BILLETERA (POCKETCASH)
-- Autor: Arquitecto Supremo
-- Descripción: Funciones atómicas para manejo de saldo con bloqueo de filas (Row Locking)
-- para prevenir condiciones de carrera, doble gasto y manipulación concurrente.
-- ==============================================================================

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
  -- Esto detiene cualquier otra transacción concurrente sobre este usuario hasta que esta termine.
  -- CORRECCION: Se usa user_id en lugar de id, ya que wallets no tiene columna id.
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
  -- CORRECCION: WHERE user_id = ...
  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = v_wallet_id;

  -- REGISTRO DE TRANSACCIÓN
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, concept, reference_type, reference_id, created_at
  ) VALUES (
    p_user_id, p_type, p_amount, p_concept, p_ref_type, p_ref_id, NOW()
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
  -- CORRECCION: Se usa user_id en lugar de id
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

  -- CORRECCION: WHERE user_id = ...
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
      p_user_id, 'debit', v_amount, 'Pago de orden #' || left(v_order_id, 8), 'order', v_order_id, NOW()
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
