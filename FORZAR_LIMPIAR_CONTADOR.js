// ============================================
// SCRIPT PARA FORZAR LIMPIEZA DEL CONTADOR
// ============================================
// Copia y pega este código en la consola del navegador (F12)
// Esto forzará la actualización del contador de notificaciones

(async function() {
  console.log('🔄 Iniciando limpieza forzada del contador...');
  
  // 1. Limpiar estado local
  console.log('1️⃣ Limpiando localStorage y sessionStorage...');
  localStorage.clear();
  sessionStorage.clear();
  
  // 2. Disparar evento de actualización
  console.log('2️⃣ Disparando evento notifications-updated...');
  window.dispatchEvent(new CustomEvent('notifications-updated', { 
    detail: { forceRefresh: true } 
  }));
  
  // 3. Esperar un momento y forzar actualización manual
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('3️⃣ Forzando recarga de alertas...');
  
  // 4. Recargar página sin caché después de 2 segundos
  setTimeout(() => {
    console.log('4️⃣ Recargando página sin caché...');
    window.location.reload(true);
  }, 2000);
  
  console.log('✅ Limpieza iniciada. La página se recargará en 2 segundos...');
})();
