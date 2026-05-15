import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

async function requireAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { ok: false as const, status: 401, error: 'Missing Authorization Bearer token' };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnon) return { ok: false as const, status: 500, error: 'Supabase env vars missing on server' };

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr) return { ok: false as const, status: 401, error: userErr.message };
  if (!userData.user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const admin = supabaseAdmin();
  const { data: row, error } = await admin.from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
  if (error) return { ok: false as const, status: 400, error: error.message };
  if (!row) return { ok: false as const, status: 403, error: 'No autorizado (admin requerido).' };

  return { ok: true as const, admin, requesterId: userData.user.id };
}

/**
 * Aprobar o rechazar una campaña publicitaria
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin, requesterId } = guard;

    const body = (await req.json().catch(() => ({}))) as {
      campaign_id: string;
      action: 'approve' | 'reject';
      rejection_reason?: string;
    };

    const { campaign_id, action, rejection_reason } = body;

    if (!campaign_id || !action) {
      return NextResponse.json({ error: 'campaign_id y action (approve|reject) son requeridos' }, { status: 400 });
    }

    if (action === 'reject' && !rejection_reason) {
      return NextResponse.json({ error: 'rejection_reason es requerido para rechazar' }, { status: 400 });
    }

    // Verificar que la campaña existe y está pagada
    const { data: campaign, error: campaignErr } = await admin
      .from('ad_campaigns')
      .select('id, payment_status, status')
      .eq('id', campaign_id)
      .single();

    if (campaignErr || !campaign) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    if (campaign.payment_status !== 'paid') {
      return NextResponse.json({ error: 'La campaña debe estar pagada antes de aprobar' }, { status: 400 });
    }

    const updateData: any = {
      status: action === 'approve' ? 'active' : 'rejected',
      approved_by: action === 'approve' ? requesterId : null,
      approved_at: action === 'approve' ? new Date().toISOString() : null,
      rejection_reason: action === 'reject' ? rejection_reason?.trim() || null : null,
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await admin.from('ad_campaigns').update(updateData).eq('id', campaign_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, status: updateData.status });
  } catch (e: unknown) {
    console.error('[ADMIN ADS APPROVE] Error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al procesar solicitud' }, { status: 500 });
  }
}
