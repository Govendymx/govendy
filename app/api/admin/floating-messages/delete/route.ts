import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const { error } = await supabaseAdmin()
      .from('admin_floating_messages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[ADMIN FLOATING MESSAGES DELETE] Error:', err);
    return NextResponse.json({ error: err?.message || 'Error al eliminar mensaje' }, { status: 500 });
  }
}
