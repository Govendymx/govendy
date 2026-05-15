/**
 * Envío de dinero a un usuario de Mercado Pago (email o user_id).
 * Requiere MERCADOPAGO_ACCESS_TOKEN y que la cuenta tenga habilitadas transferencias.
 * @see https://www.mercadopago.com.mx/developers/es/docs/your-integrations-api/money-transfers
 */

export type TransferResult = { ok: true; mp_transfer_id: string } | { ok: false; error: string };

export async function transferToMercadoPagoUser(params: {
  accessToken: string;
  amountMxn: number;
  recipientEmail: string;
  description?: string;
}): Promise<TransferResult> {
  const { accessToken, amountMxn, recipientEmail, description } = params;
  if (!accessToken?.trim()) return { ok: false, error: 'Falta MERCADOPAGO_ACCESS_TOKEN' };
  if (!Number.isFinite(amountMxn) || amountMxn <= 0) return { ok: false, error: 'Monto inválido' };
  const email = String(recipientEmail ?? '').trim();
  if (!email) return { ok: false, error: 'Falta email de cuenta Mercado Pago' };

  const body = {
    amount: Math.round(amountMxn * 100) / 100,
    currency_id: 'MXN',
    description: description || 'Pocket - Retiro de ventas',
    payee_email: email,
  };

  try {
    const res = await fetch('https://api.mercadopago.com/v1/money_transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = (json?.message ?? json?.error ?? res.statusText) || 'Error en transferencia';
      return { ok: false, error: `Mercado Pago: ${msg}` };
    }

    const id = json?.id ?? json?.transaction_id ?? json?.transfer_id;
    if (id) return { ok: true, mp_transfer_id: String(id) };
    return { ok: false, error: 'Mercado Pago no devolvió ID de transferencia' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de red';
    return { ok: false, error: msg };
  }
}
