
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xlnxdzocwgrzqoznmarc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAnyOrder() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('id, created_at, status, total')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error buscando orden:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('Últimas órdenes encontradas:');
      data.forEach(order => {
        console.log(`ID: ${order.id} | Status: ${order.status} | Fecha: ${order.created_at}`);
      });
      
      const pending = data.find(o => o.status === 'pending_payment');
      if (pending) {
         console.log(`\nURL RECOMENDADA (Pendiente): https://www.gopocket.com.mx/pago/${pending.id}`);
      } else {
         console.log(`\nURL DE EJEMPLO (Pagada/Otra): https://www.gopocket.com.mx/pago/${data[0].id}`);
      }

    } else {
      console.log('No se encontraron órdenes.');
    }
  } catch (err) {
    console.error('Error inesperado:', err);
  }
}

findAnyOrder();
