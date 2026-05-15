create or replace function deduct_wallet_funds(
  p_user_id uuid,
  p_amount numeric,
  p_concept text,
  p_ref_type text, -- Se pasará como string y se casteará internamente
  p_ref_id text
)
returns json
language plpgsql
security definer
as $$
declare
  v_balance numeric;
  v_is_frozen boolean;
  v_new_balance numeric;
  v_txn_id uuid;
begin
  -- 1. Bloquear la fila del wallet para prevenir condiciones de carrera
  select balance, is_frozen into v_balance, v_is_frozen
  from wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet not found for user %', p_user_id;
  end if;

  if v_is_frozen then
    raise exception 'El monedero está congelado';
  end if;

  if v_balance < p_amount then
    raise exception 'Saldo insuficiente. Disponible: %, Requerido: %', v_balance, p_amount;
  end if;

  v_new_balance := v_balance - p_amount;

  -- 2. Actualizar saldo
  update wallets
  set balance = v_new_balance,
      updated_at = now()
  where user_id = p_user_id;

  -- 3. Registrar transacción
  insert into wallet_transactions (
    wallet_id,
    type,
    amount,
    concept,
    reference_type,
    reference_id
  ) values (
    p_user_id,
    'debit',
    p_amount,
    p_concept,
    p_ref_type::wallet_reference_type,
    p_ref_id
  ) returning id into v_txn_id;

  return json_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'transaction_id', v_txn_id
  );
exception
  when others then
    -- Propagar el error para que lo maneje el cliente/backend
    raise;
end;
$$;
