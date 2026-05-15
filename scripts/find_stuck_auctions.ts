
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Cargar .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findStuckAuctions() {
  console.log('🔍 Buscando subastas atoradas...');
  const now = new Date().toISOString();

  // 1. Buscar subastas que ya terminaron
  const { data: auctions, error } = await supabase
    .from('listings')
    .select('id, title, status, auction_end_at, auction_highest_bidder_id, auction_highest_bid')
    .eq('sale_type', 'auction')
    .in('status', ['active', 'paused']) // Solo activas o pausadas
    .lte('auction_end_at', now)
    .not('auction_highest_bidder_id', 'is', null); // Tienen ganador

  if (error) {
    console.error('❌ Error buscando subastas:', error);
    return;
  }

  console.log(`📋 Encontradas ${auctions.length} subastas terminadas con ganador pero NO en estado 'sold'. Verificando órdenes...`);

  const stuckAuctions = [];

  for (const auction of auctions) {
    // Verificar si existe orden
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('listing_id', auction.id)
      .limit(1);

    if (!orderItems || orderItems.length === 0) {
      stuckAuctions.push(auction);
      console.log(`⚠️ Subasta ATORADA: ${auction.id} - "${auction.title}"`);
      console.log(`   Estado: ${auction.status}`);
      console.log(`   Terminó: ${auction.auction_end_at}`);
      console.log(`   Ganador: ${auction.auction_highest_bidder_id}`);
      console.log(`   Puja: ${auction.auction_highest_bid}`);
      console.log('---------------------------------------------------');
    }
  }

  console.log(`✅ Total subastas atoradas: ${stuckAuctions.length}`);
  
  if (stuckAuctions.length > 0) {
      console.log('\n💡 Sugerencia: Ejecutar script de reparación para estas subastas.');
      console.log(JSON.stringify(stuckAuctions.map(a => a.id), null, 2));
  }
}

findStuckAuctions();
