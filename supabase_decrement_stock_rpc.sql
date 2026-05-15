create or replace function decrement_stock(
  p_listing_id uuid,
  p_quantity integer
)
returns json
language plpgsql
security definer
as $$
declare
  v_current_stock integer;
  v_new_stock integer;
  v_status text;
  v_title text;
begin
  -- Lock the row to prevent race conditions
  select stock, status, title into v_current_stock, v_status, v_title
  from listings
  where id = p_listing_id
  for update;

  if not found then
    return json_build_object('success', false, 'message', 'Listing not found');
  end if;

  -- If stock is null, we assume it's unlimited or not managed numerically
  if v_current_stock is null then
     return json_build_object('success', true, 'new_stock', null, 'message', 'Stock is null (unlimited)');
  end if;

  if v_current_stock < p_quantity then
    return json_build_object(
      'success', false, 
      'message', 'Insufficient stock', 
      'current_stock', v_current_stock,
      'title', v_title
    );
  end if;

  v_new_stock := v_current_stock - p_quantity;

  update listings
  set stock = v_new_stock,
      status = case when v_new_stock = 0 then 'paused' else status end,
      updated_at = now()
  where id = p_listing_id;

  return json_build_object('success', true, 'new_stock', v_new_stock);
end;
$$;
