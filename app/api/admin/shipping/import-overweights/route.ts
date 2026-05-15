import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization') || '';
        const token = authHeader.replace('Bearer ', '');
        if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const sb = supabaseAdmin();

        // Verificar que es admin
        const { data: { user }, error: userErr } = await sb.auth.getUser(token);
        if (userErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
        if (profile?.role !== 'admin') return NextResponse.json({ error: 'Sin permisos de admin' }, { status: 403 });

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) return NextResponse.json({ error: 'El Excel no tiene hojas' }, { status: 400 });

        const sheet = workbook.Sheets[sheetName];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) return NextResponse.json({ error: 'El Excel está vacío' }, { status: 400 });

        let processed = 0;
        let notFound = 0;
        let totalFees = 0;
        const results: Array<{ tracking: string; status: string; fee?: number }> = [];

        for (const row of rows) {
            // Buscar la columna de tracking — soportar múltiples nombres
            const tracking = String(
                row['tracking_number'] || row['guia'] || row['Guía'] || row['Guia'] ||
                row['numero_guia'] || row['Número de Guía'] || row['No. Guía'] || ''
            ).trim();

            if (!tracking) {
                results.push({ tracking: '(vacío)', status: 'sin_tracking' });
                continue;
            }

            // Peso real y cargo
            const actualWeight = Number(
                row['peso_real'] || row['Peso Real'] || row['actual_weight'] || row['Peso Real (kg)'] || 0
            );
            const overweightFee = Number(
                row['cargo_sobrepeso'] || row['Cargo Sobrepeso'] || row['overweight_fee'] ||
                row['Sobrepeso'] || row['cargo'] || row['Cargo'] || 0
            );

            if (overweightFee <= 0) {
                results.push({ tracking, status: 'sin_cargo' });
                continue;
            }

            // Buscar en shipping_labels por tracking_number
            const { data: label } = await sb
                .from('shipping_labels')
                .select('id, order_id, seller_id')
                .eq('tracking_number', tracking)
                .maybeSingle();

            if (!label) {
                // Fallback: buscar en orders directamente
                const { data: order } = await sb
                    .from('orders')
                    .select('id, seller_id')
                    .eq('tracking_number', tracking)
                    .maybeSingle();

                if (!order) {
                    notFound++;
                    results.push({ tracking, status: 'no_encontrada' });
                    continue;
                }

                // Upsert en shipping_labels desde la orden
                const { error: upsertErr } = await sb.from('shipping_labels').upsert({
                    order_id: order.id,
                    seller_id: order.seller_id,
                    tracking_number: tracking,
                    actual_weight_kg: actualWeight || null,
                    overweight_fee: overweightFee,
                    overweight_status: 'pending',
                }, { onConflict: 'tracking_number' });

                if (upsertErr) {
                    results.push({ tracking, status: 'error_guardando' });
                    continue;
                }

                processed++;
                totalFees += overweightFee;
                results.push({ tracking, status: 'procesada', fee: overweightFee });
                continue;
            }

            // Actualizar shipping_labels existente
            const { error: updateErr } = await sb
                .from('shipping_labels')
                .update({
                    actual_weight_kg: actualWeight || null,
                    overweight_fee: overweightFee,
                    overweight_status: 'pending',
                })
                .eq('id', label.id);

            if (updateErr) {
                results.push({ tracking, status: 'error_actualizando' });
                continue;
            }

            processed++;
            totalFees += overweightFee;
            results.push({ tracking, status: 'procesada', fee: overweightFee });
        }

        // Registrar importación
        await sb.from('overweight_imports').insert({
            admin_id: user.id,
            filename: file.name,
            records_count: processed,
            total_overweight_fees: totalFees,
        });

        return NextResponse.json({
            success: true,
            summary: {
                total_rows: rows.length,
                processed,
                not_found: notFound,
                total_fees: totalFees,
            },
            results,
        });
    } catch (err: any) {
        console.error('[import-overweights]', err);
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
    }
}
