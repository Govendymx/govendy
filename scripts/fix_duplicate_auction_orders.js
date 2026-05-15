/**
 * Script para limpiar órdenes duplicadas de subastas
 * 
 * Problema: El cron de settlement creaba órdenes duplicadas para la misma subasta.
 * Este script encuentra todas las órdenes duplicadas (mismo listing_id en order_items)
 * y cancela las duplicadas, conservando solo la orden pagada o la primera creada.
 * 
 * USO: node scripts/fix_duplicate_auction_orders.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
    const envMap = {};
    for (const f of ['.env.local', '.env']) {
        const p = path.join(__dirname, '..', f);
        if (fs.existsSync(p)) {
            const lines = fs.readFileSync(p, 'utf-8').split('\n');
            for (const line of lines) {
                const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.+?)"?\s*$/);
                if (m) envMap[m[1]] = m[2];
            }
        }
    }
    return envMap;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
    console.log(`\n🔧 Fix Duplicate Auction Orders ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}\n`);

    // 1. Buscar listings de subasta que tienen más de 1 order_item
    const { data: items, error } = await admin
        .from('order_items')
        .select('listing_id, order_id')
        .order('listing_id');

    if (error) {
        console.error('Error fetching order_items:', error.message);
        process.exit(1);
    }

    // Agrupar por listing_id
    const byListing = {};
    for (const item of items) {
        const lid = item.listing_id;
        if (!byListing[lid]) byListing[lid] = [];
        byListing[lid].push(item.order_id);
    }

    // Filtrar duplicados
    const duplicates = Object.entries(byListing).filter(([, orderIds]) => orderIds.length > 1);

    if (duplicates.length === 0) {
        console.log('✅ No se encontraron órdenes duplicadas.');
        return;
    }

    console.log(`⚠️  Encontrados ${duplicates.length} listings con órdenes duplicadas:\n`);

    let cancelledCount = 0;

    for (const [listingId, orderIds] of duplicates) {
        // Obtener detalles de las órdenes
        const { data: orders, error: ordErr } = await admin
            .from('orders')
            .select('id, status, payment_method, paid_at, created_at, total')
            .in('id', orderIds)
            .order('created_at', { ascending: true });

        if (ordErr || !orders) {
            console.error(`  ❌ Error fetching orders for listing ${listingId}:`, ordErr?.message);
            continue;
        }

        // Buscar título del listing
        const { data: listing } = await admin
            .from('listings')
            .select('title, sale_type')
            .eq('id', listingId)
            .single();

        const title = listing?.title || listingId.slice(0, 8);

        // Solo procesar subastas (aunque el fix es genérico)
        console.log(`  📦 "${title}" (${listingId.slice(0, 8)}…) — ${orders.length} órdenes:`);

        // Determinar cuál conservar: la pagada, o la primera creada
        let keepOrder = orders.find(o => ['paid', 'approved', 'shipped', 'delivered', 'completed'].includes(o.status));
        if (!keepOrder) {
            keepOrder = orders[0]; // Conservar la primera si ninguna está pagada
        }

        for (const order of orders) {
            const isPaid = ['paid', 'approved', 'shipped', 'delivered', 'completed'].includes(order.status);
            const isKeep = order.id === keepOrder.id;
            const icon = isKeep ? '✅' : '🗑️';

            console.log(`    ${icon} ${order.id.slice(0, 8)}… | ${order.status.padEnd(18)} | $${Number(order.total).toFixed(2)} | ${order.created_at} ${isKeep ? '(CONSERVAR)' : '(CANCELAR)'}`);

            if (!isKeep && !DRY_RUN) {
                // ELIMINAR FÍSICAMENTE (Hard Delete) para que desaparezcan del panel
                
                // 1. Eliminar items primero (cascade o manual)
                const { error: itemsErr } = await admin
                    .from('order_items')
                    .delete()
                    .eq('order_id', order.id);

                if (itemsErr) {
                    console.error(`    ❌ Error deleting items for order ${order.id}:`, itemsErr.message);
                    continue;
                }

                // 2. Eliminar la orden
                const { error: deleteErr } = await admin
                    .from('orders')
                    .delete()
                    .eq('id', order.id);

                if (deleteErr) {
                    console.error(`    ❌ Error deleting order ${order.id}:`, deleteErr.message);
                } else {
                    cancelledCount++;
                    console.log(`    🗑️ Orden ${order.id.slice(0, 8)}… ELIMINADA CORRECTAMENTE.`);
                }
            }
        }

        // Si la orden conservada fue pagada pero tiene status incorrecto, corregir
        if (!DRY_RUN && keepOrder.status === 'pending_payment') {
            // Verificar si hay una wallet_transaction de débito para esta orden
            const { data: txn } = await admin
                .from('wallet_transactions')
                .select('id')
                .eq('reference_type', 'order')
                .eq('reference_id', keepOrder.id)
                .eq('type', 'debit')
                .maybeSingle();

            if (txn) {
                console.log(`    🔧 Corrigiendo estado de ${keepOrder.id.slice(0, 8)}… de pending_payment → paid (wallet_transaction encontrada)`);
                await admin
                    .from('orders')
                    .update({
                        status: 'paid',
                        payment_status: 'paid',
                        payment_method: 'pocketcash',
                        paid_at: new Date().toISOString(),
                    })
                    .eq('id', keepOrder.id);
            }
        }

        console.log('');
    }

    if (DRY_RUN) {
        console.log(`\n🔍 DRY RUN: ${duplicates.length} listings con duplicados detectados. Ejecuta sin --dry-run para aplicar cambios.`);
    } else {
        console.log(`\n✅ Limpieza completada: ${cancelledCount} órdenes duplicadas canceladas.`);
    }
}

main().catch(console.error);
