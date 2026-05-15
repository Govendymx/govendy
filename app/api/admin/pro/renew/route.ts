
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WalletService } from '@/lib/services/wallet/wallet.service';
import { notify } from '@/lib/notifications/service';
import { addDays } from 'date-fns';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { error: 'Missing token', status: 401 };

  const admin = supabaseAdmin();
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  // Check admin_users table
  const { data: adminUser } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (!adminUser) return { error: 'Forbidden', status: 403 };

  return { admin, user };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { userId, days, cost, paymentMethod } = await req.json();

    if (!userId || !days) {
      return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const admin = supabaseAdmin();

    // 1. Handle Payment (if cost > 0)
    if (cost > 0) {
      if (paymentMethod === 'pocket_cash') {
        try {
          await WalletService.deductFunds(
            userId,
            cost,
            `Renovación Suscripción PRO (${days} días)`,
            'subscription',
            `pro_${new Date().getTime()}`
          );
        } catch (err: any) {
          return NextResponse.json({ error: `Error de pago: ${err.message}` }, { status: 400 });
        }
      }
      // If 'admin_manual', we assume admin collected payment externally
    }

    // 2. Calculate Dates
    // Fetch current subscription
    const { data: profile } = await admin
      .from('profiles')
      .select('pro_subscription_end')
      .eq('id', userId)
      .single();

    const now = new Date();
    const currentEnd = profile?.pro_subscription_end ? new Date(profile.pro_subscription_end) : null;
    
    // If active, add to end date. If expired/null, start from now.
    const baseDate = (currentEnd && currentEnd > now) ? currentEnd : now;
    const newEnd = addDays(baseDate, days);

    // 3. Update Profile
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        is_pro: true,
        pro_subscription_start: profile?.pro_subscription_end ? undefined : now.toISOString(), // Only set start if new
        pro_subscription_end: newEnd.toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // 4. Log Transaction
    await admin.from('pro_subscription_logs').insert({
      user_id: userId,
      operation_id: `renew_${new Date().getTime()}`,
      amount: cost || 0,
      days_added: days,
      payment_method: paymentMethod || 'manual',
      status: 'completed',
      metadata: { admin_id: auth.user!.id }
    });

    // 5. Notify User
    await notify(admin, {
      user_id: userId,
      type: 'system',
      title: '¡Suscripción PRO Renovada!',
      message: `Tu suscripción PRO ha sido renovada por ${days} días. Vence el ${newEnd.toLocaleDateString()}.`,
      link_to: '/vender'
    });

    return NextResponse.json({ success: true, newEnd });
  } catch (err: any) {
    console.error('Renew error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
