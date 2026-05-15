import { NextRequest, NextResponse } from 'next/server';
import { WalletService } from '@/lib/services/wallet/wallet.service';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const transactions = await WalletService.getTransactions(auth.effectiveUserId);
    return NextResponse.json({ transactions });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
