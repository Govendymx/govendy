create or replace function decrement_stock(
  p_listing_id uuid,
  p_quantity integer,
  p_size text default null
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
  v_size_stock jsonb;
  v_current_size_stock integer;
begin
  -- Lock the row to prevent race conditions
  select stock, status, title, size_stock into v_current_stock, v_status, v_title, v_size_stock
  from listings
  where id = p_listing_id
  for update;

  if not found then
    return json_build_object('success', false, 'message', 'Listing not found');
  end if;

  -- Logic for Size Variant
  if p_size is not null then
    if v_size_stock is null then
       return json_build_object('success', false, 'message', 'Size stock not found for listing');
    end if;

    begin
      v_current_size_stock := (v_size_stock->>p_size)::integer;
    exception when others then
      v_current_size_stock := 0;
    end;

    if v_current_size_stock < p_quantity then
      return json_build_object(
        'success', false, 
        'message', 'Insufficient stock for size ' || p_size, 
        'current_stock', v_current_size_stock,
        'title', v_title
      );
    end if;

    v_size_stock := v_size_stock || jsonb_build_object(p_size, v_current_size_stock - p_quantity);

    select sum(value::integer) into v_new_stock
    from jsonb_each_text(v_size_stock);

    update listings
    set size_stock = v_size_stock,
        stock = v_new_stock,
        status = case when v_new_stock <= 0 then 'paused' else status end,
        updated_at = now()
    where id = p_listing_id;

    return json_build_object('success', true, 'new_stock', v_new_stock);
  end if;

  -- Logic for Simple Stock (no size)
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
      status = case when v_new_stock <= 0 then 'paused' else status end,
      updated_at = now()
  where id = p_listing_id;

  return json_build_object('success', true, 'new_stock', v_new_stock);
end;
$$;
