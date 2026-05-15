create or replace function deduct_wallet_batch(
  p_user_id uuid,
  p_transactions jsonb -- Array of {amount, concept, ref_type, ref_id}
)
returns json
language plpgsql
security definer
as $$
declare
  v_balance numeric;
  v_is_frozen boolean;
  v_total_amount numeric := 0;
  v_new_balance numeric;
  v_txn_obj jsonb;
begin
  -- 1. Calcular total requerido
  select sum((x->>'amount')::numeric) into v_total_amount
  from jsonb_array_elements(p_transactions) x;

  -- 2. Bloquear wallet
  select balance, is_frozen into v_balance, v_is_frozen
  from wallets
  where user_id = p_user_id
  for update;

  if not found then
    return json_build_object('success', false, 'message', 'Wallet not found');
  end if;

  if v_is_frozen then
    return json_build_object('success', false, 'message', 'El monedero está congelado');
  end if;

  if v_balance < v_total_amount then
    return json_build_object('success', false, 'message', 'Saldo insuficiente para cubrir el total');
  end if;

  v_new_balance := v_balance - v_total_amount;

  -- 3. Actualizar saldo
  update wallets
  set balance = v_new_balance,
      updated_at = now()
  where user_id = p_user_id;

  -- 4. Insertar transacciones
  for v_txn_obj in select * from jsonb_array_elements(p_transactions)
  loop
    insert into wallet_transactions (
      wallet_id, type, amount, concept, reference_type, reference_id
    ) values (
      p_user_id,
      'debit',
      (v_txn_obj->>'amount')::numeric,
      v_txn_obj->>'concept',
      (v_txn_obj->>'ref_type')::wallet_reference_type,
      v_txn_obj->>'ref_id'
    );
  end loop;

  return json_build_object('success', true, 'new_balance', v_new_balance);
exception when others then
  return json_build_object('success', false, 'message', SQLERRM);
end;
$$;