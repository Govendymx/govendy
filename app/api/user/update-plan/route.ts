import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WalletService } from '@/lib/services/wallet/wallet.service';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    // Validate token -> user
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);

    if (userErr || !userData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { plan } = body;

    if (!plan || !['basic', 'pro', 'platinum'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan type' }, { status: 400 });
    }

    // Use admin client to bypass RLS
    const admin = supabaseAdmin();

    // First check if profile exists
    const { data: profile, error: fetchError } = await admin
      .from('profiles')
      .select('id, plan_type, pro_subscription_start, pro_subscription_end')
      .eq('id', userData.user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching profile:', fetchError);
      // If profile doesn't exist or other error
      if (fetchError.code === 'PGRST116') { // JSON object requested, multiple (or no) rows returned
        // Profile missing, try to create it
        const { error: insertError } = await admin
          .from('profiles')
          .insert({
            id: userData.user.id,
            email: userData.user.email,
            plan_type: plan
          });

        if (insertError) {
          console.error('Error creating profile:', insertError);
          return NextResponse.json({ error: `Failed to create profile: ${insertError.message}` }, { status: 500 });
        }
        return NextResponse.json({ success: true, message: 'Profile created and plan updated' });
      }

      return NextResponse.json({ error: `Failed to fetch profile: ${fetchError.message}` }, { status: 500 });
    }

    // Profile exists, update it
    // Charge PocketCash for paid plans
    const planPrices: Record<string, number> = { pro: 699, platinum: 999 };
    const price = planPrices[plan] || 0;

    if (price > 0) {
      // Check wallet balance
      const { data: wallet } = await admin
        .from('wallets')
        .select('balance')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      const currentBalance = Number(wallet?.balance || 0);
      if (currentBalance < price) {
        return NextResponse.json({
          error: `Saldo insuficiente. Necesitas $${price} MXN y tienes $${currentBalance.toFixed(2)} MXN. Recarga tu PocketCash primero.`
        }, { status: 402 });
      }

      // Deduct from wallet
      try {
        await WalletService.deductFunds(
          userData.user.id,
          price,
          `Pago Plan ${plan.toUpperCase()} — $${price} MXN (30 días)`,
          'subscription',
          userData.user.id
        );
      } catch (walletErr: any) {
        console.error('Error deducting wallet:', walletErr);
        return NextResponse.json({
          error: `Error al cobrar: ${walletErr.message || 'No se pudo descontar de tu PocketCash'}`
        }, { status: 500 });
      }
    }

    const updateData: any = { plan_type: plan };

    if (plan === 'pro' || plan === 'platinum') {
      const now = new Date();

      // Check existing subscription to extend if active
      let currentEnd = profile.pro_subscription_end ? new Date(profile.pro_subscription_end) : null;
      let newStart = now;
      let newEnd = new Date(now);

      if (currentEnd && currentEnd > now) {
        // Active subscription: Extend 30 days from current end date
        newStart = profile.pro_subscription_start ? new Date(profile.pro_subscription_start) : now;
        newEnd = new Date(currentEnd);
        newEnd.setDate(newEnd.getDate() + 30);
      } else {
        // Expired or new: Start now + 30 days
        newEnd.setDate(now.getDate() + 30);
      }

      updateData.pro_subscription_start = newStart.toISOString();
      updateData.pro_subscription_end = newEnd.toISOString();
    } else {
      // If switching back to basic, maybe we keep history or clear? 
      // User requested "control", implying strictness. Let's clear active period.
      updateData.pro_subscription_start = null;
      updateData.pro_subscription_end = null;
    }

    const { error: updateError } = await admin
      .from('profiles')
      .update(updateData)
      .eq('id', userData.user.id);

    if (updateError) {
      console.error('Error updating plan:', updateError);
      return NextResponse.json({ error: `Failed to update plan: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Plan update error:', error);
    return NextResponse.json({ error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}
