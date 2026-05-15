import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
    try {
        const admin = supabaseAdmin();

        // Verificar admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });

        const { data: adminRow } = await admin.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
        if (!adminRow) return NextResponse.json({ error: 'Prohibido' }, { status: 403 });

        const body = await req.json();
        const { reportId, action, adminNotes } = body;

        if (!reportId || !action) {
            return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 });
        }

        // Obtener el reporte para saber qué publicación afectar
        const { data: report, error: reportError } = await admin
            .from('listing_reports')
            .select('listing_id')
            .eq('id', reportId)
            .single();

        if (reportError || !report) {
            return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 });
        }

        // Actualizar el estado del reporte
        let reportStatus = 'reviewed';
        if (action === 'ignore') reportStatus = 'ignored';
        else reportStatus = 'resolved';

        const { error: updateReportError } = await admin
            .from('listing_reports')
            .update({
                status: reportStatus,
                admin_notes: adminNotes,
                updated_at: new Date().toISOString()
            })
            .eq('id', reportId);

        if (updateReportError) throw updateReportError;

        // Si la acción requiere modificar la publicación
        if (action !== 'ignore') {
            let listingStatus = 'active';
            let isDeleted = false;

            if (action === 'suspend') listingStatus = 'paused';
            else if (action === 'delete') {
                listingStatus = 'blocked';
                isDeleted = true;
            } else if (action === 'request_edit') {
                listingStatus = 'paused';
                // Aquí se podría agregar una nota a la publicación si existiera la columna
            }

            const updatePayload: any = { status: listingStatus };
            if (isDeleted) {
                updatePayload.is_deleted = true;
                updatePayload.deleted_at = new Date().toISOString();
            }

            const { error: updateListingError } = await admin
                .from('listings')
                .update(updatePayload)
                .eq('id', report.listing_id);

            if (updateListingError) throw updateListingError;
        }

        return NextResponse.json({ ok: true, message: 'Acción realizada con éxito' });
    } catch (err: any) {
        console.error('[admin-reports-action] error:', err);
        return NextResponse.json({ error: 'Error al procesar la acción' }, { status: 500 });
    }
}
