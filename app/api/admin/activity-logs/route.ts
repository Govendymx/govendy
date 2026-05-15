import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Verificar autenticación (Bearer token)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const admin = supabaseAdmin();
    const { data: { user }, error: authError } = await admin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verificar rol de admin
    const { data: adminUser } = await admin
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Obtener logs recientes
    const { data: logs, error: dbError } = await admin
      .from('admin_operation_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (dbError) {
      // Si la tabla no existe, devolver array vacío en lugar de error 500 para no romper el dashboard
      if (dbError.code === '42P01') { // undefined_table
        console.warn('Table admin_operation_events does not exist yet.');
        return NextResponse.json({ logs: [] });
      }
      throw dbError;
    }

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error('[API ACTIVITY LOGS] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
