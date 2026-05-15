import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendTransactionalEmail } from './send';
import * as T from './templates';

async function getEmailForUser(userId: string): Promise<string | null> {
  try {
    const admin = supabaseAdmin();
    const r: any = await admin.auth.admin.getUserById(userId);
    const email = String(r?.data?.user?.email ?? '').trim();
    if (!email) {
      console.warn(`[getEmailForUser] No email found for user ${userId}`);
    }
    return email || null;
  } catch (err) {
    console.error(`[getEmailForUser] Error fetching email for user ${userId}:`, err);
    return null;
  }
}

async function getUserName(userId: string): Promise<string | undefined> {
  try {
    const admin = supabaseAdmin();
    // Intentar obtener desde profiles
    const { data: profile } = await admin.from('profiles').select('full_name, name').eq('id', userId).maybeSingle();
    if (profile) {
      const fullName = (profile as any)?.full_name || (profile as any)?.name;
      if (fullName && typeof fullName === 'string' && fullName.trim()) {
        return fullName.trim();
      }
    }
    // Fallback: obtener desde auth metadata
    const r: any = await admin.auth.admin.getUserById(userId);
    const metadata = r?.data?.user?.user_metadata;
    if (metadata) {
      const name = metadata.full_name || metadata.name;
      if (name && typeof name === 'string' && name.trim()) {
        return name.trim();
      }
    }
    // Fallback: usar email sin dominio
    const email = r?.data?.user?.email;
    if (email && typeof email === 'string') {
      const emailName = email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
  } catch {
    // noop
  }
  return undefined;
}

/**
 * Determina qué dirección de email usar según el tipo de notificación
 * Organización lógica por categoría de negocio
 */
function getEmailAddressForNotificationType(
  type: 'payment' | 'order' | 'dispute' | 'estafeta' | 'support' | 'question' | 'listing' | 'default',
): {
  from: string;
  fromName: string;
} {
  switch (type) {
    // NOTA: Dominio verificado correctamente. Usando direcciones oficiales.
    case 'payment':
      return { from: 'ventas@gopocket.com.mx', fromName: 'GoVendy Ventas' };
    case 'order':
      return { from: 'info@gopocket.com.mx', fromName: 'GoVendy Info' };
    case 'dispute':
      return { from: 'soporte@gopocket.com.mx', fromName: 'GoVendy Soporte' };
    case 'support':
      return { from: 'soporte@gopocket.com.mx', fromName: 'GoVendy Soporte' };
    case 'question':
      return { from: 'info@gopocket.com.mx', fromName: 'GoVendy Info' };
    case 'listing':
      return { from: 'ventas@gopocket.com.mx', fromName: 'GoVendy Ventas' };
    case 'estafeta':
      return { from: 'info@gopocket.com.mx', fromName: 'GoVendy Info' };
    default:
      // Fallback seguro usando el dominio verificado
      return {
        from: 'contacto@gopocket.com.mx',
        fromName: 'GoVendy',
      };
  }
}

/**
 * Envía correo de "pago acreditado" al comprador.
 * Fire-and-forget; no lanza. Se usa tras webhook MP o confirmación offline.
 */
export async function notifyPaymentApprovedBuyer(opts: {
  buyerId: string;
  orderIds: string[];
  total?: number;
}): Promise<void> {
  const email = await getEmailForUser(opts.buyerId);
  if (!email) return;
  const userName = await getUserName(opts.buyerId);
  const { subject, html, text } = T.orderPaymentApprovedBuyer({
    orderIds: opts.orderIds,
    total: opts.total,
    userName,
  });
  const { from, fromName } = getEmailAddressForNotificationType('payment');
  await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
}

/**
 * Envía correo de "nueva venta pagada" a cada vendedor distinto de las órdenes.
 * Fire-and-forget.
 */
export async function notifyPaymentApprovedSellers(opts: {
  admin: ReturnType<typeof supabaseAdmin>;
  orderIds: string[];
  orderTotals?: Record<string, number>;
}): Promise<void> {
  const { admin, orderIds, orderTotals } = opts;
  if (!orderIds.length) return;
  const { data: rows } = await admin
    .from('orders')
    .select('id,seller_id,total')
    .in('id', orderIds);
  const bySeller = new Map<string, { orderIds: string[]; total: number }>();
  for (const o of rows ?? []) {
    const sid = String((o as any)?.seller_id ?? '').trim();
    if (!sid) continue;
    const id = String((o as any)?.id ?? '');
    const total = Number((o as any)?.total ?? 0) || (orderTotals?.[id] ?? 0);
    if (!bySeller.has(sid)) bySeller.set(sid, { orderIds: [], total: 0 });
    const rec = bySeller.get(sid)!;
    rec.orderIds.push(id);
    rec.total += total;
  }
  for (const [sellerId, rec] of Array.from(bySeller)) {
    const email = await getEmailForUser(sellerId);
    if (!email) continue;
    const { subject, html, text } = T.orderPaymentApprovedSeller({
      orderIds: rec.orderIds,
      total: rec.total || undefined,
    });
    const { from, fromName } = getEmailAddressForNotificationType('payment');
    await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
  }
}

/**
 * Pago rechazado → comprador.
 */
export async function notifyPaymentRejectedBuyer(opts: { buyerId: string; reason?: string }): Promise<void> {
  const email = await getEmailForUser(opts.buyerId);
  if (!email) return;
  const userName = await getUserName(opts.buyerId);
  const { subject, html, text } = T.orderPaymentRejectedBuyer({ userName, reason: opts.reason });
  const { from, fromName } = getEmailAddressForNotificationType('payment');
  await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
}

/**
 * Orden enviada → comprador.
 */
export async function notifyOrderShippedBuyer(opts: {
  buyerId: string;
  orderId: string;
  tracking?: string;
  carrier?: string;
}): Promise<void> {
  const email = await getEmailForUser(opts.buyerId);
  if (!email) return;
  const userName = await getUserName(opts.buyerId);
  const { subject, html, text } = T.orderShippedBuyer({
    orderId: opts.orderId,
    tracking: opts.tracking,
    carrier: opts.carrier,
    userName,
  });
  const { from, fromName } = getEmailAddressForNotificationType('order');
  await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
}

/**
 * Comprador confirmó recepción → vendedor.
 */
export async function notifyConfirmReceivedSeller(opts: { sellerId: string; orderId: string; amount?: number }): Promise<void> {
  const email = await getEmailForUser(opts.sellerId);
  if (!email) return;
  const userName = await getUserName(opts.sellerId);
  const { subject, html, text } = T.orderConfirmReceivedSeller({ orderId: opts.orderId, userName, amount: opts.amount });
  const { from, fromName } = getEmailAddressForNotificationType('order');
  await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
}

/**
 * Admin marcó como entregado → vendedor (dinero liberado).
 */
export async function notifyMarkedDeliveredByAdminSeller(opts: { sellerId: string; orderId: string }): Promise<void> {
  const email = await getEmailForUser(opts.sellerId);
  if (!email) return;
  const { subject, html, text } = T.orderMarkedDeliveredByAdminSeller({ orderId: opts.orderId });
  const { from, fromName } = getEmailAddressForNotificationType('order');
  await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
}

/**
 * Disputa abierta → comprador y vendedor.
 */
export async function notifyDisputeOpened(opts: {
  buyerId: string;
  sellerId: string;
  orderId: string;
}): Promise<void> {
  const [buyerEmail, sellerEmail, buyerName, sellerName] = await Promise.all([
    getEmailForUser(opts.buyerId),
    getEmailForUser(opts.sellerId),
    getUserName(opts.buyerId),
    getUserName(opts.sellerId),
  ]);
  const bu = T.disputeOpened({ orderId: opts.orderId, isBuyer: true, userName: buyerName });
  const su = T.disputeOpened({ orderId: opts.orderId, isBuyer: false, userName: sellerName });
  const { from, fromName } = getEmailAddressForNotificationType('dispute');
  if (buyerEmail) await sendTransactionalEmail({ to: buyerEmail, subject: bu.subject, html: bu.html, text: bu.text, from, fromName });
  if (sellerEmail) await sendTransactionalEmail({ to: sellerEmail, subject: su.subject, html: su.html, text: su.text, from, fromName });
}

/**
 * Disputa resuelta → comprador y vendedor.
 */
export async function notifyDisputeResolved(opts: {
  buyerId: string;
  sellerId: string;
  orderId: string;
  decision?: string;
}): Promise<void> {
  const [buyerEmail, sellerEmail] = await Promise.all([
    getEmailForUser(opts.buyerId),
    getEmailForUser(opts.sellerId),
  ]);
  const { subject, html, text } = T.disputeResolved({ orderId: opts.orderId, decision: opts.decision });
  const { from, fromName } = getEmailAddressForNotificationType('dispute');
  if (buyerEmail) await sendTransactionalEmail({ to: buyerEmail, subject, html, text, from, fromName });
  if (sellerEmail) await sendTransactionalEmail({ to: sellerEmail, subject, html, text, from, fromName });
}

/**
 * Pago Estafeta acreditado → usuario que pagó.
 */
export async function notifyEstafetaPaymentApproved(opts: { userId: string; amount: number }): Promise<void> {
  const email = await getEmailForUser(opts.userId);
  if (!email) return;
  const userName = await getUserName(opts.userId);
  const { subject, html, text } = T.estafetaPaymentApproved({ amount: opts.amount, userName });
  const { from, fromName } = getEmailAddressForNotificationType('estafeta');
  await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
}

/**
 * Nueva pregunta recibida → vendedor.
 */
export async function notifyQuestionReceived(opts: {
  sellerId: string;
  listingTitle: string;
  questionText: string;
  listingId: string;
}): Promise<void> {
  const email = await getEmailForUser(opts.sellerId);
  if (!email) {
    console.warn(`[notifyQuestionReceived] Email not found for seller ${opts.sellerId}`);
    return;
  }
  
  // Fetch listing image
  const admin = supabaseAdmin();
  const { data: listing } = await admin
    .from('listings')
    .select('images')
    .eq('id', opts.listingId)
    .maybeSingle();
    
  const listingImageUrl = listing?.images?.[0] || undefined;

  const userName = await getUserName(opts.sellerId);
  const { subject, html, text } = T.questionReceived({
    userName,
    questionText: opts.questionText,
    listingTitle: opts.listingTitle,
    listingId: opts.listingId,
    listingImageUrl,
  });
  const { from, fromName } = getEmailAddressForNotificationType('question');
  await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
}

/**
 * Envía recordatorio de carrito abandonado.
 */
export async function notifyAbandonedCart(opts: {
  userId: string;
  items: Array<{ title: string; price: string; image?: string }>;
  cartLink: string;
}): Promise<void> {
  const email = await getEmailForUser(opts.userId);
  if (!email) return;

  const userName = await getUserName(opts.userId);
  const { subject, html, text } = T.abandonedCart({
    userName,
    items: opts.items,
    cartLink: opts.cartLink,
  });

  // Usamos 'default' o 'listing' para promociones
  const fromInfo = getEmailAddressForNotificationType('default');
  
  await sendTransactionalEmail({
    to: email,
    subject,
    html,
    text,
    from: fromInfo.from,
    fromName: fromInfo.fromName,
  });
}



/**
 * Respuesta recibida → usuario que preguntó.
 */
export async function notifyAnswerReceived(opts: {
  askerId: string;
  listingTitle: string;
  answerText: string;
  listingId: string;
}): Promise<void> {
  const email = await getEmailForUser(opts.askerId);
  if (!email) return;

  // Fetch listing image
  const admin = supabaseAdmin();
  const { data: listing } = await admin
    .from('listings')
    .select('images')
    .eq('id', opts.listingId)
    .maybeSingle();
    
  const listingImageUrl = listing?.images?.[0] || undefined;

  const userName = await getUserName(opts.askerId);
  const { subject, html, text } = T.answerReceived({
    userName,
    answerText: opts.answerText,
    listingTitle: opts.listingTitle,
    listingId: opts.listingId,
    listingImageUrl,
  });
  const { from, fromName } = getEmailAddressForNotificationType('question');
  await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
}

/**
 * Subasta perdida (outbid) → usuario superado.
 */
export async function notifyAuctionLost(opts: {
  bidderId: string;
  listingTitle: string;
  listingId: string;
}): Promise<void> {
  const email = await getEmailForUser(opts.bidderId);
  if (!email) return;
  const userName = await getUserName(opts.bidderId);
  const { subject, html, text } = T.auctionLost({
    userName,
    listingTitle: opts.listingTitle,
    listingId: opts.listingId,
  });
  const { from, fromName } = getEmailAddressForNotificationType('listing');
  await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
}

/**
 * Bienvenida → nuevo usuario.
 */
export async function notifyWelcome(opts: { userId: string }): Promise<void> {
  const email = await getEmailForUser(opts.userId);
  if (!email) return;
  const userName = await getUserName(opts.userId);
  const { subject, html, text } = T.welcome({ userName });
  const { from, fromName } = getEmailAddressForNotificationType('default');
  await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
}

/**
 * Restablecer contraseña → usuario.
 */
export async function notifyResetPassword(opts: { userId?: string; email?: string; resetLink: string }): Promise<{ ok: boolean; error?: string }> {
  let email = opts.email;
  let userName: string | undefined;

  if (opts.userId) {
    if (!email) {
      const fetched = await getEmailForUser(opts.userId);
      if (fetched) email = fetched;
    }
    userName = await getUserName(opts.userId);
  }

  if (!email) return { ok: false, error: 'No email provided or found' };

  const { subject, html, text } = T.resetPassword({ userName, resetLink: opts.resetLink });
  const { from, fromName } = getEmailAddressForNotificationType('default');
  return await sendTransactionalEmail({ to: email, subject, html, text, from, fromName });
}
