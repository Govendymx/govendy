import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
    try {
        const admin = supabaseAdmin();

        // Verificar autenticación
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) {
            return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
        }

        const body = await req.json();
        const { listingId, reason, comment } = body;

        if (!listingId || !reason) {
            return NextResponse.json({ error: 'Faltan campos obligatorios (listingId, reason)' }, { status: 400 });
        }

        // Insertar reporte
        const { error: insertError } = await admin
            .from('listing_reports')
            .insert({
                listing_id: listingId,
                reporter_id: user.id,
                reason: reason,
                comment: comment || null,
                status: 'pending'
            });

        if (insertError) {
            console.error('[report-listing] error:', insertError);
            return NextResponse.json({ error: 'Error al enviar el reporte' }, { status: 500 });
        }

        return NextResponse.json({ ok: true, message: 'Reporte enviado con éxito' });
    } catch (err: any) {
        console.error('[report-listing] system error:', err);
        return NextResponse.json({ error: 'Error del sistema' }, { status: 500 });
    }
}
