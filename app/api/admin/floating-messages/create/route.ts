import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      content_html,
      image_url,
      message_type = 'html',
      section = 'all',
      position_x = 20,
      position_y = 20,
      starts_at,
      ends_at,
      width = 320,
      height,
      background_color = '#ffffff',
      text_color = '#000000',
      border_color = '#e5e7eb',
      z_index = 10000,
      is_draggable = true,
      is_closable = true,
      is_active = true,
      target_user_ids,
      redirect_url,
    } = body;

    // Validar campos requeridos
    if (!title) {
      return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
    }

    if (message_type === 'html' && !content_html) {
      return NextResponse.json({ error: 'El contenido HTML es requerido para mensajes HTML' }, { status: 400 });
    }

    if (message_type === 'image' && !image_url) {
      return NextResponse.json({ error: 'La URL de imagen es requerida para mensajes de imagen' }, { status: 400 });
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

    // Crear el mensaje
    const { data, error } = await supabaseAdmin()
      .from('admin_floating_messages')
      .insert({
        title,
        content_html: content_html || null,
        image_url: image_url || null,
        message_type,
        section,
        position_x,
        position_y,
        starts_at: starts_at || new Date().toISOString(),
        ends_at: ends_at || null,
        width,
        height,
        background_color,
        text_color,
        border_color,
        z_index,
        is_draggable,
        is_closable,
        is_active,
        target_user_ids: target_user_ids && Array.isArray(target_user_ids) && target_user_ids.length > 0 ? target_user_ids : null,
        redirect_url: redirect_url && redirect_url.trim() ? redirect_url.trim() : null,
        created_by: userData.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: data });
  } catch (err: any) {
    console.error('[ADMIN FLOATING MESSAGES CREATE] Error:', err);
    return NextResponse.json({ error: err?.message || 'Error al crear mensaje' }, { status: 500 });
  }
}
