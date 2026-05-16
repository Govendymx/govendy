export type BuyerAddressView = {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  colonia?: string;
  phone?: string;
  reference?: string;
  full?: string;
  source?: 'order' | 'profile' | '';
};

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = String(obj[k] ?? '').trim();
    if (v) return v;
  }
  return '';
}

function parseShippingAddress(addr: unknown): Omit<BuyerAddressView, 'source'> | null {
  if (!addr) return null;
  let obj: Record<string, unknown>;
  if (typeof addr === 'string') {
    try {
      obj = JSON.parse(addr) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof addr === 'object' && addr !== null) {
    obj = addr as Record<string, unknown>;
  } else {
    return null;
  }

  const streetBase = pickStr(obj, ['street', 'address', 'address_street', 'line1', 'calle']);
  const extNum = pickStr(obj, ['ext_number', 'exterior', 'num_ext']);
  const intNum = pickStr(obj, ['int_number', 'interior', 'num_int']);
  const street = [streetBase, extNum ? `#${extNum}` : '', intNum ? `Int. ${intNum}` : '']
    .filter(Boolean)
    .join(' ');
  const colonia = pickStr(obj, ['colonia', 'neighborhood', 'colony', 'suburb']);
  const city = pickStr(obj, ['city', 'municipality', 'municipio']);
  const state = pickStr(obj, ['state', 'estado', 'province']);
  const zip = pickStr(obj, ['zip', 'zip_code', 'postal_code', 'cp']);
  const reference = pickStr(obj, ['reference', 'references', 'notes', 'referencia']);
  const phone = pickStr(obj, ['phone', 'telefono', 'mobile']);
  const parts = [street, colonia, city, state, zip].filter(Boolean);

  if (!parts.length && !phone) return null;
  return {
    street: street || streetBase,
    colonia,
    city,
    state,
    zip,
    reference,
    phone,
    full: parts.join(', '),
  };
}

/** Prioridad: dirección guardada en la orden (checkout), luego perfil del comprador. */
export function resolveBuyerAddress(
  order: { shipping_address?: unknown; shipping_phone?: string | null; shipping_full_name?: string | null } | null | undefined,
  profileAddr: BuyerAddressView | null | undefined,
): BuyerAddressView | null {
  const fromOrder = parseShippingAddress(order?.shipping_address);
  const orderPhone = String(order?.shipping_phone || '').trim();
  const orderName = String(order?.shipping_full_name || '').trim();

  if (fromOrder?.full || fromOrder?.phone || orderPhone) {
    return {
      ...fromOrder,
      phone: orderPhone || fromOrder?.phone || profileAddr?.phone,
      reference: fromOrder?.reference || (orderName ? `Destinatario: ${orderName}` : undefined),
      full: fromOrder?.full || profileAddr?.full,
      source: 'order',
    };
  }

  if (profileAddr && (profileAddr.full || profileAddr.phone)) {
    return { ...profileAddr, source: 'profile' };
  }

  return null;
}
