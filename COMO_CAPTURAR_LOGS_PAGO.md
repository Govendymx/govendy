# 📋 Cómo Capturar los Logs para Diagnosticar el Problema del Pago

## 🎯 Objetivo
Capturar los logs cuando marcas un pago como "pagado" para diagnosticar por qué el status queda en "pending" en lugar de "paid".

---

## 📝 Pasos para Capturar los Logs

### 1. Abre la Consola del Navegador
- Presiona `F12` o `Ctrl+Shift+I`
- Ve a la pestaña **Console**

### 2. Abre la Terminal del Servidor
- Busca la ventana de PowerShell/CMD donde ejecutaste `npm run dev`
- O abre una nueva terminal y ejecuta `npm run dev` si no está corriendo

### 3. Marca un Pago como Pagado
- Ve a `/admin/pagos`
- Encuentra un pago con status "pending"
- Haz clic en **"Marcar pagado"**
- Ingresa tu nombre cuando se solicite
- Haz clic en **"Aceptar"**

### 4. Copia los Logs

#### En la Consola del Navegador (F12 → Console):
Busca estos mensajes:
```
[admin/pagos] Enviando actualización: { checkoutId: '...', action: 'mark_paid', ... }
[admin/pagos] Respuesta recibida: { httpStatus: 200, action: 'mark_paid', expectedStatus: 'paid', receivedStatus: '...', matches: true/false, ... }
```

#### En la Terminal del Servidor:
Busca estos mensajes:
```
[admin/offline-update] start { checkoutId: '...', action: 'mark_paid', beforeStatus: '...', nextStatus: 'paid' }
[admin/offline-update] update result { checkoutId: '...', action: 'mark_paid', hasError: false/true, ... }
[admin/offline-update] verified { checkoutId: '...', verifiedStatus: '...', nextStatus: 'paid', matches: true/false, ... }
```

---

## 🔍 Qué Buscar en los Logs

### ✅ Si Todo Está Bien:
- `action: 'mark_paid'`
- `nextStatus: 'paid'`
- `verifiedStatus: 'paid'`
- `matches: true`
- `receivedStatus: 'paid'`

### ❌ Si Hay Problema:
- `action: 'mark_paid'` pero `verifiedStatus: 'pending'`
- `matches: false`
- `receivedStatus: 'pending'` cuando `expectedStatus: 'paid'`

---

## 📤 Comparte los Logs Completos

Copia y pega:
1. **Todos los logs de la consola del navegador** que empiecen con `[admin/pagos]`
2. **Todos los logs del servidor** que empiecen con `[admin/offline-update]`
3. **Cualquier error** que aparezca en rojo

---

## 🆘 Si No Ves los Logs

1. **Verifica que el servidor esté corriendo**: Deberías ver `✓ Ready` en la terminal
2. **Recarga la página**: Presiona `F5` o `Ctrl+R`
3. **Limpia la consola**: Haz clic en el ícono de limpiar (🚫) en la consola
4. **Intenta de nuevo**: Marca el pago como pagado otra vez

---

## 💡 Nota

Los logs solo aparecen cuando **realizas la acción** de marcar un pago como pagado. Los logs de inicialización (como los que compartiste) no muestran el problema.
