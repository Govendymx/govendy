# ⭐ Funcionalidad: Calificar Comprador al Subir Guía

## ✅ Cambios Implementados

### 1. Modificación en `app/dashboard/ventas/page.tsx`

**Cambio:** La lógica de `canRateBuyer` ahora se activa cuando:
- Hay guía subida (`labelUrl` existe) **O**
- El estado es `completed`, `delivered`, o `received`

**Antes:**
```typescript
const canRateBuyer = Boolean(orderId && buyerId && status === 'completed' && !alreadyRated);
```

**Después:**
```typescript
const canRateBuyer = Boolean(
  orderId && 
  buyerId && 
  !alreadyRated && 
  (labelUrl || status === 'completed' || status === 'delivered' || status === 'received')
);
```

**Efecto:** El botón "⭐ Calificar comprador" aparece cuando se sube la guía, no solo cuando está completado.

### 2. Modificación en `app/api/orders/rate-buyer/route.ts`

**Cambio:** La API ahora permite calificar cuando:
- Hay guía subida (`shipping_label_url` existe) **O**
- El estado es `completed`, `delivered`, o `received`

**Antes:**
```typescript
if (!['completed', 'delivered', 'received'].includes(status)) {
  return NextResponse.json({ error: 'Aún no puedes calificar...' }, { status: 400 });
}
```

**Después:**
```typescript
const labelUrl = String((order as any)?.shipping_label_url || '').trim();
const canRate = labelUrl || ['completed', 'delivered', 'received'].includes(status);
if (!canRate) {
  return NextResponse.json({ error: 'Aún no puedes calificar...' }, { status: 400 });
}
```

**Efecto:** Los vendedores pueden calificar al comprador inmediatamente después de que se suba la guía.

### 3. Mejoras en la UI

- El botón muestra "⭐ Calificar comprador" cuando hay guía subida
- El mensaje "✅ Comprador calificado" aparece cuando ya se calificó, independientemente del estado

## 🎯 Funcionalidad Completa

### Modal de Calificación

Cuando el vendedor hace clic en "⭐ Calificar comprador":
1. Se abre un modal con:
   - **10 botones numerados (1-10)** para seleccionar estrellas
   - **Campo de comentario** (opcional, máx. 600 caracteres)
   - **Botones:** Cancelar y Enviar calificación

2. Al enviar:
   - Se guarda en `user_ratings` con `direction = 'seller_to_buyer'`
   - Se notifica al comprador
   - El comentario aparece en su perfil público como comprador

### Visualización en Perfil

Las calificaciones se muestran en:
- `/perfil/[buyerId]` - Perfil público del comprador
- `/dashboard/reputacion` - Panel de reputación del comprador
- Sección "Comentarios como comprador" - Opiniones de vendedores

## 📋 Flujo Completo

1. **Admin sube guía** → Se actualiza `orders.shipping_label_url`
2. **Vendedor ve la guía** en `/dashboard/ventas`
3. **Aparece botón "⭐ Calificar comprador"** (nuevo)
4. **Vendedor hace clic** → Se abre modal de calificación
5. **Vendedor selecciona estrellas (1-10)** y opcionalmente escribe comentario
6. **Vendedor envía** → Se guarda en `user_ratings`
7. **Comprador recibe notificación** → "Tu compra fue calificada"
8. **Comentario aparece en perfil** del comprador

## ✅ Estado

- ✅ Botón aparece cuando hay guía subida
- ✅ Modal de calificación funcional (1-10 estrellas)
- ✅ Campo de comentario funcional
- ✅ API permite calificar cuando hay guía
- ✅ Calificaciones se muestran en perfil público
- ✅ Notificación al comprador

## 🧪 Para Probar

1. Sube una guía de envío (desde admin/logistica)
2. Ve a `/dashboard/ventas` como vendedor
3. Deberías ver el botón "⭐ Calificar comprador"
4. Haz clic y califica al comprador
5. Verifica que el comentario aparece en `/perfil/[buyerId]`
