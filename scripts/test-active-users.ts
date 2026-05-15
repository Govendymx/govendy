
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testActiveUsers() {
  console.log('🧪 Iniciando prueba de usuarios activos...');

  try {
    // 1. Obtener un usuario válido para evitar error de FK
    const { data: validUser } = await supabase.from('profiles').select('id').limit(1).single();
    
    if (!validUser) {
      console.log('⚠️ No se encontraron usuarios en profiles para realizar la prueba. Saltando validación de inserción.');
      return;
    }
    
    const testUserId = validUser.id;
    console.log(`👤 Usando usuario existente: ${testUserId}`);

    // IPs únicas para esta prueba
    const ipBase = `10.0.${Math.floor(Math.random()*255)}.`;
    const users = [
      { ip: `${ipBase}1`, offset: 0, label: 'Activo (Ahora)' },
      { ip: `${ipBase}2`, offset: 5, label: 'Activo (Hace 5m)' },
      { ip: `${ipBase}3`, offset: 14, label: 'Activo (Hace 14m)' },
      { ip: `${ipBase}4`, offset: 20, label: 'Inactivo (Hace 20m)' },
    ];

    // 2. Insertar datos de prueba
    console.log('📝 Insertando registros de IP...');
    for (const u of users) {
      const detectedAt = new Date(Date.now() - u.offset * 60 * 1000).toISOString();
      await supabase.from('user_ips').insert({
        user_id: testUserId,
        ip_address: u.ip,
        detected_at: detectedAt,
        country: 'TestLand',
        city: 'TestCity',
        metadata: { test_run: true }
      });
    }

    // 3. Simular consulta del admin panel
    console.log('🔍 Consultando usuarios activos (últimos 15 min)...');
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    // Consultamos filtrando por las IPs de prueba para aislar el test
    const testIps = users.map(u => u.ip);
    const { data: activeUsers, error } = await supabase
      .from('user_ips')
      .select('ip_address, detected_at')
      .gt('detected_at', fifteenMinutesAgo)
      .in('ip_address', testIps);

    if (error) throw error;

    console.log(`📊 Registros encontrados: ${activeUsers.length}`);
    activeUsers.forEach(u => console.log(`   - ${u.ip_address} (${u.detected_at})`));

    // 4. Validaciones
    const foundIps = activeUsers.map(u => u.ip_address);
    const missing = users.slice(0, 3).filter(u => !foundIps.includes(u.ip));
    const unexpected = users.slice(3).filter(u => foundIps.includes(u.ip));

    let success = true;

    if (missing.length > 0) {
      console.error('❌ Error: Faltan registros activos:', missing.map(u => u.ip));
      success = false;
    }

    if (unexpected.length > 0) {
      console.error('❌ Error: Aparecen registros inactivos:', unexpected.map(u => u.ip));
      success = false;
    }

    if (success) {
      console.log('✅ PRUEBA EXITOSA: El panel mostrará correctamente los usuarios de los últimos 15 min.');
    } else {
      console.error('❌ PRUEBA FALLIDA');
    }

    // 5. Limpieza
    console.log('🧹 Limpiando datos de prueba...');
    await supabase.from('user_ips').delete().in('ip_address', testIps);

  } catch (err) {
    console.error('💥 Error fatal:', err);
  }
}

testActiveUsers();
