# 🔍 Diagnóstico: Pago queda en "pending" en lugar de "paid"

## 📋 Problema Reportado

**Debug Response:**
```json
{
  "httpStatus": 200,
  "json": {
    "ok": true,
    "status": "pending",  // ⚠️ Debería ser "paid"
    "updatedOrders": 1,
    "notifiedSellers": 0,
    "notifyErrors": [],
    "session": {
      "id": "7460386f-72ba-4bb6-a57f-8946c080c28c",
      "status": "pending",  // ⚠️ Debería ser "paid"
      "paid_confirmed_at": null,  // ⚠️ Debería tener fecha
      "paid_confirmed_by": null,  // ⚠️ Debería tener admin ID
      "updated_at": "2026-01-25T10:57:21.898929+00:00"
    }
  }
}
```

## 🔍 Posibles Causas

### 1. Acción Incorrecta
Si se ejecutó `mark_unpaid` en lugar de `mark_paid`, el comportamiento es correcto:
- `status: "pending"` ✅
- `paid_confirmed_at: null` ✅
- `paid_confirmed_by: null` ✅
- `updatedOrders: 1` ✅ (la orden se actualiza a `pending_payment`)

### 2. Verificación Falla Silenciosamente
El código tiene una verificación (líneas 252-267) que debería detectar si el status no coincide:
```typescript
if (verifiedStatus !== nextStatus) {
  return NextResponse.json({ error: ... }, { status: 400 });
}
```

Si esta verificación pasó pero el status es incorrecto, hay un bug.

### 3. Trigger o Constraint en BD
Podría haber un trigger en PostgreSQL que está revirtiendo el cambio.

## ✅ Solución: Verificar Logs del Servidor

Revisa los logs del servidor (terminal donde corre `npm run dev`) y busca:

```
[admin/offline-update] start { checkoutId, action, beforeStatus, nextStatus }
[admin/offline-update] verified { checkoutId, verifiedStatus, nextStatus, updatedOrders, notifiedSellers }
```

**Qué buscar:**
1. ¿Qué `action` se envió? (`mark_paid` o `mark_unpaid`)
2. ¿Qué `nextStatus` se esperaba? (`paid` o `pending`)
3. ¿Qué `verifiedStatus` se obtuvo? (debería coincidir con `nextStatus`)

## 🛠️ Pasos para Diagnosticar

1. **Revisa los logs del servidor** cuando hagas clic en "Marcar como pagado"
2. **Verifica en Supabase** directamente:
   ```sql
   SELECT id, status, paid_confirmed_at, paid_confirmed_by, updated_at 
   FROM checkout_sessions 
   WHERE id = '7460386f-72ba-4bb6-a57f-8946c080c28c';
   ```
3. **Verifica las órdenes relacionadas**:
   ```sql
   SELECT id, status, paid_at 
   FROM orders 
   WHERE id IN (
     SELECT unnest(order_ids) 
     FROM checkout_sessions 
     WHERE id = '7460386f-72ba-4bb6-a57f-8946c080c28c'
   );
   ```

## 🔧 Si el Problema Persiste

Si confirmas que:
- ✅ La acción fue `mark_paid`
- ✅ El código debería funcionar
- ❌ Pero el status queda en `pending`

Entonces hay un problema con:
1. **RLS Policies**: Verifica que `supabaseAdmin()` pueda actualizar `checkout_sessions`
2. **Triggers**: Verifica si hay triggers que revierten cambios
3. **Constraints**: Verifica si hay constraints que bloquean el update

## 📝 Nota

El código actual tiene verificación robusta (líneas 217-267) que debería detectar este problema y devolver un error 400. Si recibes un 200 con `ok: true` pero `status: "pending"`, significa que la verificación pasó, lo cual es extraño.
