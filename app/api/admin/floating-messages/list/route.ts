import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin()
      .from('admin_floating_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ messages: data || [] });
  } catch (err: any) {
    console.error('[ADMIN FLOATING MESSAGES LIST] Error:', err);
    return NextResponse.json({ error: err?.message || 'Error al cargar mensajes' }, { status: 500 });
  }
}
