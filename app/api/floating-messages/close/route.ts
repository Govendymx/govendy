import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message_id } = body;

    if (!message_id) {
      return NextResponse.json({ error: 'message_id es requerido' }, { status: 400 });
    }

    // Obtener el usuario actual
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Marcar mensaje como cerrado
    const { error } = await supabaseAdmin()
      .from('user_closed_messages')
      .insert({
        user_id: userData.user.id,
        message_id,
      })
      .select()
      .single();

    if (error) {
      // Si ya existe, no es un error
      if (error.code !== '23505') {
        throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[FLOATING MESSAGES CLOSE] Error:', err);
    return NextResponse.json({ error: err?.message || 'Error al cerrar mensaje' }, { status: 500 });
  }
}
