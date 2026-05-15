import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message_id, position_x, position_y } = body;

    if (!message_id || position_x === undefined || position_y === undefined) {
      return NextResponse.json({ error: 'message_id, position_x y position_y son requeridos' }, { status: 400 });
    }

    // Guardar posición en localStorage del cliente (no en BD para no sobrecargar)
    // Esta ruta solo valida, el cliente guarda en localStorage
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[FLOATING MESSAGES POSITION] Error:', err);
    return NextResponse.json({ error: err?.message || 'Error al guardar posición' }, { status: 500 });
  }
}
