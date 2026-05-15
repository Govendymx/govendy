-- ═══════════════════════════════════════════════════════════════════════════════
-- Función atómica para compra de horas Live con PocketCash
-- REGISTRA en wallet_transactions para trazabilidad completa
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION purchase_live_hours(
    p_user_id       uuid,
    p_package_id    text,
    p_minutes       integer,
    p_price_mxn     numeric,
    p_hours_label   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan_type     text;
    v_sub_end       timestamptz;
    v_current_cash  numeric;
    v_new_cash      numeric;
    v_old_balance   integer;
    v_new_balance   integer;
    v_order_id      text;
    v_tx_id         uuid;
BEGIN
    -- 0. Generar un ID de orden único para esta compra
    v_order_id := 'LIVE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

    -- 1. Verificar plan del usuario
    SELECT plan_type, pro_subscription_end
    INTO v_plan_type, v_sub_end
    FROM profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Usuario no encontrado', 'status', 404);
    END IF;

    -- 2. Verificar expiración de suscripción
    IF (v_plan_type = 'platinum' OR v_plan_type = 'pro') AND v_sub_end IS NOT NULL THEN
        IF now() > v_sub_end THEN
            v_plan_type := 'basic';
        END IF;
    END IF;

    IF v_plan_type = 'basic' THEN
        RETURN jsonb_build_object('error', 'Necesitas plan Pro o Platinum', 'status', 403);
    END IF;

    -- 3. Obtener saldo de wallets con bloqueo de fila (FOR UPDATE)
    SELECT balance
    INTO v_current_cash
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Monedero no encontrado', 'status', 404);
    END IF;

    -- 4. Verificar saldo suficiente
    IF v_current_cash < p_price_mxn THEN
        RETURN jsonb_build_object('error', 'PocketCash insuficiente', 'status', 400);
    END IF;

    -- 5. Deducir PocketCash del monedero
    v_new_cash := v_current_cash - p_price_mxn;
    UPDATE wallets
    SET balance = v_new_cash
    WHERE user_id = p_user_id AND balance >= p_price_mxn;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Error de concurrencia al deducir saldo', 'status', 409);
    END IF;

    -- 6. Registrar transacción en wallet_transactions (TRAZABILIDAD COMPLETA)
    INSERT INTO wallet_transactions (
        wallet_id,
        type,
        amount,
        concept,
        reference_type,
        reference_id,
        created_at
    ) VALUES (
        p_user_id,
        'debit',
        p_price_mxn,
        'GoPocket Lives - Compra ' || p_hours_label || 'h (paquete ' || p_package_id || ')',
        'live_hours',
        v_order_id,
        now()
    )
    RETURNING id INTO v_tx_id;

    -- 7. Acreditar minutos extra (upsert atómico)
    SELECT COALESCE(minutes_balance, 0)
    INTO v_old_balance
    FROM live_extra_hours
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        v_old_balance := 0;
        INSERT INTO live_extra_hours (user_id, minutes_balance, updated_at)
        VALUES (p_user_id, p_minutes, now());
    ELSE
        UPDATE live_extra_hours
        SET minutes_balance = v_old_balance + p_minutes, updated_at = now()
        WHERE user_id = p_user_id;
    END IF;

    v_new_balance := v_old_balance + p_minutes;

    -- 8. Retornar resultado exitoso con IDs de trazabilidad
    RETURN jsonb_build_object(
        'ok', true,
        'order_id', v_order_id,
        'transaction_id', v_tx_id,
        'minutes_added', p_minutes,
        'new_balance_minutes', v_new_balance,
        'new_pocket_cash', v_new_cash,
        'status', 200
    );
END;
$$;
