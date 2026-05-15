// ============================================
// VER QUÉ RETORNA LA API
// ============================================
// Copia y pega esto en la consola del navegador (F12 → Console)

(async function verAPI() {
  try {
    // Obtener token
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = 'https://xlnxdzocwgrzqoznmarc.supabase.co';
    const supabaseAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5OTI2MTgsImV4cCI6MjA1MjU2ODYxOH0.placeholder';
    
    const supabase = createClient(supabaseUrl, supabaseAnon);
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    
    if (!token) {
      console.error('❌ No hay token de sesión');
      return;
    }
    
    console.log('🔍 Llamando a /api/alerts/summary...');
    
    // Llamar a la API
    const res = await fetch(`/api/alerts/summary?t=${Date.now()}&_nocache=${Math.random()}`, {
      headers: { authorization: `Bearer ${token}` }
    });
    
    const data = await res.json();
    
    console.log('📊 RESPUESTA DE LA API:');
    console.log('  Total Alerts:', data.totalAlerts);
    console.log('  Alerts:', data.alerts);
    console.log('  Desglose completo:');
    
    if (Array.isArray(data.alerts)) {
      data.alerts.forEach((alert, idx) => {
        console.log(`    ${idx + 1}. ${alert.label}: ${alert.count} (id: ${alert.id})`);
      });
    }
    
    // Verificar notificaciones en BD
    console.log('\n🔍 Verificando notificaciones en BD...');
    const notifRes = await fetch(`/api/notifications/list?limit=10&_t=${Date.now()}`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const notifData = await notifRes.json();
    console.log('  Notificaciones no leídas:', notifData.unread_count);
    console.log('  Total notificaciones:', notifData.rows?.length || 0);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();
