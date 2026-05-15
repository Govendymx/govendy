import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WalletService } from '@/lib/services/wallet/wallet.service';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check (Admin)
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check if user is admin
    const { data: adminUser } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 2. Parse body
    const body = await req.json();
    const { userId, amount, type, concept } = body;

    if (!userId || !amount || !type || !concept) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type !== 'credit' && type !== 'debit') {
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
    }

    // 3. Perform action
    let txn;
    if (type === 'credit') {
      txn = await WalletService.addFunds(
        userId,
        Number(amount),
        concept,
        'manual_adjustment',
        user.id // Admin ID as reference
      );
    } else {
      txn = await WalletService.deductFunds(
        userId,
        Number(amount),
        concept,
        'manual_adjustment',
        user.id
      );
    }

    return NextResponse.json({ success: true, transaction: txn });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
