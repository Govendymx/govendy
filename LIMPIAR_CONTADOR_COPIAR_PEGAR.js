// ============================================
// LIMPIAR CONTADOR - COPIA Y PEGA ESTO
// ============================================
// 1. Abre la consola del navegador (F12)
// 2. Ve a la pestaña "Console"
// 3. Copia y pega TODO este código
// 4. Presiona Enter

(async function limpiarContador() {
  console.log('🔄 Iniciando limpieza del contador...');
  
  try {
    // 1. Limpiar almacenamiento local
    console.log('1️⃣ Limpiando localStorage y sessionStorage...');
    localStorage.clear();
    sessionStorage.clear();
    console.log('   ✅ Almacenamiento limpiado');
    
    // 2. Disparar evento de actualización forzada
    console.log('2️⃣ Disparando evento de actualización...');
    window.dispatchEvent(new CustomEvent('notifications-updated', { 
      detail: { forceRefresh: true } 
    }));
    console.log('   ✅ Evento disparado');
    
    // 3. Obtener token y verificar API
    console.log('3️⃣ Verificando API...');
    const supabase = window.supabase || (await import('@/lib/supabase/client')).supabase;
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    
    if (token) {
      const res = await fetch(`/api/alerts/summary?t=${Date.now()}&_nocache=${Math.random()}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      console.log('   📊 Total Alerts desde API:', data.totalAlerts);
      console.log('   📊 Alerts:', data.alerts);
      
      if (data.totalAlerts === 0) {
        console.log('   ✅ API retorna 0 alertas - El contador debería desaparecer');
      } else {
        console.log('   ⚠️ API retorna', data.totalAlerts, 'alertas');
        console.log('   📋 Desglose:', data.alerts);
      }
    }
    
    // 4. Esperar un momento y recargar
    console.log('4️⃣ Recargando página en 2 segundos...');
    setTimeout(() => {
      console.log('   🔄 Recargando...');
      window.location.reload(true);
    }, 2000);
    
    console.log('✅ Limpieza iniciada. La página se recargará automáticamente.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('🔄 Recargando página de todas formas...');
    setTimeout(() => window.location.reload(true), 1000);
  }
})();
