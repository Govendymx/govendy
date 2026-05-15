import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

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
    const { topup_id, proof_url } = body;

    if (!topup_id || !proof_url) {
      return NextResponse.json({ error: 'Faltan datos (topup_id, proof_url)' }, { status: 400 });
    }

    const admin = supabaseAdmin();
    
    // Verificar que el topup pertenezca al usuario y esté en estado pending_proof
    const { data: topup, error: fetchErr } = await admin
      .from('wallet_topups')
      .select('*')
      .eq('id', topup_id)
      .eq('user_id', userData.user.id)
      .single();

    if (fetchErr || !topup) {
      return NextResponse.json({ error: 'Recarga no encontrada o no autorizada' }, { status: 404 });
    }

    if (topup.status !== 'pending_proof') {
      return NextResponse.json({ error: 'El estado de la recarga no permite subir comprobante' }, { status: 400 });
    }

    // Actualizar estado y guardar URL
    // HACK: Use mercadopago_preference_id as metadata storage if metadata is missing
    let currentMetadata = topup.metadata || {};
    
    // If metadata is empty but preference_id has JSON, use that
    if (!topup.metadata && topup.mercadopago_preference_id && topup.mercadopago_preference_id.startsWith('{')) {
      try {
        currentMetadata = JSON.parse(topup.mercadopago_preference_id);
      } catch (e) {
        console.error('Error parsing preference_id JSON', e);
      }
    }

    const newMetadata = {
      ...currentMetadata,
      proof_url
    };

    // Prepare update object
    const updateData: any = {
      status: 'pending_approval',
      updated_at: new Date().toISOString()
    };

    // If metadata column exists (it shouldn't based on previous checks, but let's be safe if it appears), use it.
    // Otherwise put it in mercadopago_preference_id as string
    // Since we know metadata is missing, we force preference_id usage for now.
    // Actually, we should check if we can update metadata. Since we can't detect schema at runtime easily without error,
    // and we know it failed before, let's assume we must use preference_id.
    
    updateData.mercadopago_preference_id = JSON.stringify(newMetadata);

    const { error: updateErr } = await admin
      .from('wallet_topups')
      .update(updateData)
      .eq('id', topup_id);

    if (updateErr) {
      console.error('Error updating topup proof:', updateErr);
      return NextResponse.json({ error: 'Error al actualizar la recarga' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
