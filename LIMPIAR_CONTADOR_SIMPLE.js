// ============================================
// VERSIÓN SIMPLE - COPIA Y PEGA
// ============================================
// Abre consola (F12) → Console → Pega esto → Enter

localStorage.clear();
sessionStorage.clear();
window.dispatchEvent(new CustomEvent('notifications-updated', { detail: { forceRefresh: true } }));
setTimeout(() => location.reload(true), 1000);
