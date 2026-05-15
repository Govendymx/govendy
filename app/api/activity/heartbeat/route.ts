import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Endpoint para registrar la actividad del usuario (heartbeat)
 * Se llama periódicamente para mantener al usuario como "activo"
 */
export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = userData.user.id;
    const admin = supabaseAdmin();

    // Usar la función de upsert para actualizar la actividad
    try {
      const { error: upsertError } = await admin.rpc('upsert_user_activity', { p_user_id: userId });
      if (upsertError) {
        // Si la función no existe, hacer un upsert manual
        const { error: insertError } = await admin
          .from('user_activity')
          .upsert(
            {
              user_id: userId,
              last_activity_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (insertError) {
          console.error('[HEARTBEAT] Error actualizando actividad:', insertError);
          return NextResponse.json({ error: 'Error al actualizar actividad' }, { status: 500 });
        }
      }
    } catch (err) {
      console.error('[HEARTBEAT] Error:', err);
      // Intentar upsert manual como fallback
      try {
        const { error: insertError } = await admin
          .from('user_activity')
          .upsert(
            {
              user_id: userId,
              last_activity_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (insertError) {
          console.error('[HEARTBEAT] Error en fallback:', insertError);
        }
      } catch (fallbackErr) {
        console.error('[HEARTBEAT] Error en fallback:', fallbackErr);
      }
    }

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (e: unknown) {
    console.error('[HEARTBEAT] Error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al registrar actividad' },
      { status: 500 }
    );
  }
}
