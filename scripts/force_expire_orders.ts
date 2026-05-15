
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Fix for ES module scope
const __dirname = path.resolve();

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log('Iniciando script de expiración masiva de órdenes...');
  
  // 1. Buscar todas las órdenes 'paid' que NO tengan tracking ni fecha de envío
  // y que hayan expirado según sus días de manejo.
  
  // Nota: Para hacerlo masivo y seguro, iteraremos sobre órdenes 'paid'.
  // En producción real esto debería ser paginado o un job background.
  
  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id, created_at, status, buyer_id, seller_id, 
      shipped_at, tracking_number,
      order_items (listing_id)
    `)
    .eq('status', 'paid')
    .is('shipped_at', null)
    .is('tracking_number', null)
    .limit(1000); // Límite de seguridad
    
  if (error) {
    console.error('Error buscando órdenes:', error);
    process.exit(1);
  }
  
  console.log(`Encontradas ${orders.length} órdenes pagadas y no enviadas.`);
  
  let disputesOpened = 0;
  let skipped = 0;
  let errors = 0;
  
  // Obtener todos los listings involucrados para checar handling_days
  const allListingIds = new Set();
  orders.forEach(o => {
    if (o.order_items) {
      o.order_items.forEach((item: any) => allListingIds.add(item.listing_id));
    }
  });
  
  const listingIdsArray = Array.from(allListingIds);
  const { data: listings } = await supabase
    .from('listings')
    .select('id, handling_days')
    .in('id', listingIdsArray);
    
  const handlingDaysMap: Record<string, number> = {};
  listings?.forEach((l: any) => {
    handlingDaysMap[l.id] = l.handling_days || 3;
  });

  for (const order of orders) {
    // Calcular deadline
    const itemListingIds = order.order_items.map((i: any) => i.listing_id);
    let maxHandling = 3;
    if (itemListingIds.length > 0) {
      maxHandling = Math.max(...itemListingIds.map((lid: string) => handlingDaysMap[lid] || 3));
    }
    
    const createdAt = new Date(order.created_at);
    let current = new Date(createdAt);
    let daysAdded = 0;
    const targetDays = maxHandling === 0 ? 1 : maxHandling;

    while (daysAdded < targetDays) {
        current.setDate(current.getDate() + 1);
        // Simular zona horaria de México (UTC-6)
        const mexicoDate = new Date(current.getTime() - 6 * 60 * 60 * 1000);
        if (mexicoDate.getUTCDay() !== 0) { 
            daysAdded++;
        }
    }
    
    const deadline = current.getTime();
    const now = Date.now();
    const gracePeriod = 2 * 60 * 60 * 1000; // 2h de gracia
    
    // Si NO ha expirado, saltar
    if (now < deadline - gracePeriod) {
      skipped++;
      continue;
    }
    
    console.log(`Orden ${order.id} expirada. Deadline: ${new Date(deadline).toISOString()}. Abriendo disputa...`);
    
    // Verificar si ya tiene disputa
    const { data: existing } = await supabase
      .from('disputes')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle();
      
    if (existing) {
      console.log(`- Orden ${order.id} ya tiene disputa ${existing.id}. Saltando.`);
      skipped++;
      continue;
    }
    
    // Crear disputa
    try {
      const { data: dispute, error: dispErr } = await supabase
        .from('disputes')
        .insert({
          order_id: order.id,
          buyer_id: order.buyer_id,
          seller_id: order.seller_id,
          opened_by: order.buyer_id,
          reason_code: 'not_received',
          reason_text: 'Disputa automática: El vendedor no envió el producto dentro del tiempo establecido.',
          status: 'open'
        })
        .select()
        .single();
        
      if (dispErr) throw dispErr;
      
      // Actualizar orden
      await supabase.from('orders').update({ status: 'disputed' }).eq('id', order.id);
      
      // Notificaciones (simplificado, solo insert directo si tabla existe)
      // Omitimos la lógica compleja de notificaciones aquí para mantener el script simple,
      // asumiendo que el usuario verá el estado en su dashboard.
      
      disputesOpened++;
      console.log(`✅ Disputa ${dispute.id} creada para orden ${order.id}`);
      
    } catch (e: any) {
      console.error(`❌ Error creando disputa para orden ${order.id}:`, e.message);
      errors++;
    }
  }
  
  console.log('--- Resumen ---');
  console.log(`Total procesadas: ${orders.length}`);
  console.log(`Disputas abiertas: ${disputesOpened}`);
  console.log(`Saltadas (no expiradas o ya con disputa): ${skipped}`);
  console.log(`Errores: ${errors}`);
}

run().catch(console.error);
