
-- Función segura para transferencias P2P usando ID de PocketCash
-- Garantiza atomicidad: o se hace todo (descuento + abono + historial) o nada.

CREATE OR REPLACE FUNCTION transfer_pocket_funds(
  p_sender_id UUID,
  p_recipient_card TEXT,
  p_amount NUMERIC,
  p_concept TEXT DEFAULT 'Transferencia P2P'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con permisos del creador (admin) para acceder a saldos ajenos
AS $$
DECLARE
  v_recipient_id UUID;
  v_sender_balance NUMERIC;
  v_recipient_balance NUMERIC;
  v_transfer_id UUID;
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

  -- 4. Verificar saldo del remitente (Bloqueo de fila para evitar race conditions)
  SELECT balance INTO v_sender_balance
  FROM wallets
  WHERE user_id = p_sender_id
  FOR UPDATE; -- Bloquea la fila hasta el commit

  IF v_sender_balance < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Saldo insuficiente.');
  END IF;

  -- 5. Realizar Transferencia (Actualizar saldos)
  
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

  -- 6. Registrar Transacciones (Historial)
  v_transfer_id := gen_random_uuid();

  -- Débito para remitente
  INSERT INTO wallet_transactions (wallet_id, type, amount, concept, reference_type, reference_id, created_at)
  VALUES (p_sender_id, 'debit', p_amount, 'Envío a ' || p_recipient_card, 'p2p_transfer', v_transfer_id::text, NOW());

  -- Crédito para destinatario
  INSERT INTO wallet_transactions (wallet_id, type, amount, concept, reference_type, reference_id, created_at)
  VALUES (v_recipient_id, 'credit', p_amount, 'Recibido de ' || (SELECT pocket_cash_number FROM wallets WHERE user_id = p_sender_id), 'p2p_transfer', v_transfer_id::text, NOW());

  RETURN json_build_object('success', true, 'message', 'Transferencia exitosa', 'new_balance', v_sender_balance - p_amount);

EXCEPTION WHEN OTHERS THEN
  -- Rollback automático en caso de error SQL
  RETURN json_build_object('success', false, 'message', 'Error interno: ' || SQLERRM);
END;
$$;
