import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const admin = supabaseAdmin();

        // Verificar admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

        const { data: adminRow } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
        if (!adminRow) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

        // Obtener reportes
        const { data: reports, error } = await admin
            .from('listing_reports')
            .select('*, listing:listings(id, public_id, title, status, seller_id)')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[admin-reports] error:', error);
            return NextResponse.json({ error: 'Error al obtener reportes' }, { status: 500 });
        }

        // Enriquecer con el nombre del denunciante por separado
        const reporterIds = [...new Set((reports ?? []).map((r: any) => r.reporter_id).filter(Boolean))];
        let reporterMap: Record<string, string> = {};

        if (reporterIds.length > 0) {
            const { data: profiles } = await admin
                .from('profiles')
                .select('id, full_name')
                .in('id', reporterIds);
            for (const p of profiles ?? []) {
                reporterMap[p.id] = (p as any).full_name || 'Usuario';
            }
        }

        const enriched = (reports ?? []).map((r: any) => ({
            ...r,
            reporter: { id: r.reporter_id, full_name: reporterMap[r.reporter_id] || 'Usuario' },
        }));

        return NextResponse.json({ ok: true, reports: enriched });
    } catch (err: any) {
        console.error('[admin-reports] system error:', err);
        return NextResponse.json({ error: 'Error del sistema' }, { status: 500 });
    }
}
