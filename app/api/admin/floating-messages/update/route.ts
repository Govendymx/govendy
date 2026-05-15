import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin()
      .from('admin_floating_messages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: data });
  } catch (err: any) {
    console.error('[ADMIN FLOATING MESSAGES UPDATE] Error:', err);
    return NextResponse.json({ error: err?.message || 'Error al actualizar mensaje' }, { status: 500 });
  }
}
