import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { WalletService } from '@/lib/services/wallet/wallet.service';
import { handleError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Validar autenticación segura (Server-Side)
    const { userId, admin } = await requireAuth(request);

    // 2. Parsear body
    const body = await request.json();
    const { recipient_card_number, amount, concept, reference, recipient_name } = body;

    if (!recipient_card_number || !amount) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    // 3. Limpiar formato (quitar espacios)
    const cleanCard = String(recipient_card_number).replace(/\s/g, '');

    // 3.1 Sanitizar strings opcionales
    const sanitize = (v?: string) =>
      String(v ?? '')
        .replace(/[\r\n]+/g, ' ')
        .trim()
        .slice(0, 100);
    const sConcept = sanitize(concept);
    const sRef = sanitize(reference);
    const sName = sanitize(recipient_name);

    // Componer concepto enriquecido
    const conceptParts: string[] = [];
    conceptParts.push(sConcept || 'Transferencia P2P');
    if (sName) conceptParts.push(`Para: ${sName}`);
    if (sRef) conceptParts.push(`Ref: ${sRef}`);
    const finalConcept = conceptParts.join(' | ');

    // 4. Ejecutar transferencia atómica
    const result = await WalletService.transferFunds(
      userId,
      cleanCard,
      Number(amount),
      finalConcept
    );

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // 5. Recuperar clave de rastreo (reference_id generado en la transacción más reciente)
    const { data: lastTx } = await admin
      .from('wallet_transactions')
      .select('reference_id, created_at')
      .eq('wallet_id', userId)
      .eq('reference_type', 'p2p_transfer')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const transferId = typeof lastTx?.reference_id === 'string' && lastTx.reference_id
      ? String(lastTx.reference_id)
      : null;
    const trackingKey = transferId ? `TRF-${transferId.slice(0, 8).toUpperCase()}` : null;

    return NextResponse.json({ ...result, transfer_id: transferId, tracking_key: trackingKey });

  } catch (error: any) {
    console.error('[Transfer API] Error:', error);
    // Usar el manejador de errores estandarizado si está disponible o fallback manual
    const msg = error.message || 'Error interno';
    const status = error.statusCode || 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
