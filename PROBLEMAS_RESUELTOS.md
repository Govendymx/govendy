# 🔧 Problemas Resueltos - Historial de Soluciones

Este documento contiene un registro de todos los problemas que hemos encontrado y resuelto durante el desarrollo del proyecto.

---

## 📋 Índice de Problemas

1. [Errores de Compilación](#errores-de-compilación)
2. [Problemas de Base de Datos](#problemas-de-base-de-datos)
3. [Problemas de Notificaciones](#problemas-de-notificaciones)
4. [Problemas de UI/UX](#problemas-de-uiux)
5. [Problemas de Chat/Tiempo Real](#problemas-de-chattiempo-real)

---

## 🔴 Errores de Compilación

### Problema 1: `insertNotificationBestEffort` definido múltiples veces

**Error**:
```
Error: the name `insertNotificationBestEffort` is defined multiple times
```

**Ubicación**: `app/api/admin/payments/offline/update/route.ts`

**Causa**: La función estaba importada y también definida localmente en el mismo archivo.

**Solución**:
- Eliminar la definición local de la función (líneas 8-47)
- Usar solo la importada desde `@/lib/notifications/insertBestEffort`

**Código corregido**:
```typescript
// ❌ ANTES (incorrecto)
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';
async function insertNotificationBestEffort(admin: any, payload: any) { ... }

// ✅ DESPUÉS (correcto)
import { insertNotificationBestEffort } from '@/lib/notifications/insertBestEffort';
// Usar directamente la función importada
```

---

### Problema 2: `Type 'Set<string>' can only be iterated`

**Error**:
```
Type error: Type 'Set<string>' can only be iterated through when using the '--downlevelIteration' flag
```

**Ubicación**: `app/api/disputes/messages/route.ts:198`

**Causa**: TypeScript requiere configuración especial para iterar sobre Sets directamente.

**Solución**:
Convertir el Set a Array antes de iterar.

**Código corregido**:
```typescript
// ❌ ANTES (incorrecto)
for (const uid of notifyTargets) { ... }

// ✅ DESPUÉS (correcto)
for (const uid of Array.from(notifyTargets)) { ... }
```

---

### Problema 3: `Type 'RegExpStringIterator' can only be iterated`

**Error**:
```
Type error: Type 'RegExpStringIterator<RegExpExecArray>' can only be iterated through
```

**Ubicación**: `lib/moderation/listingContentPolicy.ts:28`

**Causa**: `matchAll()` retorna un iterador que requiere configuración especial.

**Solución**:
Convertir el iterador a Array antes de iterar.

**Código corregido**:
```typescript
// ❌ ANTES (incorrecto)
for (const m of text.matchAll(re)) { ... }

// ✅ DESPUÉS (correcto)
for (const m of Array.from(text.matchAll(re))) { ... }
```

---

### Problema 4: Error de tipos en banners

**Error**:
```
Type error: Conversion of type 'ParserError<...>' to type 'BannerRow' may be a mistake
```

**Ubicación**: `app/admin/banners/page.tsx:333`

**Causa**: TypeScript no puede inferir correctamente el tipo de `data` después del insert.

**Solución**:
Usar doble cast a través de `unknown`.

**Código corregido**:
```typescript
// ❌ ANTES (incorrecto)
setRows((prev) => [data as BannerRow, ...prev])

// ✅ DESPUÉS (correcto)
if (!data) throw new Error('No se recibió data del insert');
setRows((prev) => [data as unknown as BannerRow, ...prev])
```

---

## 🗄️ Problemas de Base de Datos

### Problema 5: `22P02 invalid input value for enum notification_type: "listing_answer"`

**Error**:
```
22P02 invalid input value for enum notification_type: "listing_answer"
```

**Ubicación**: Sistema de notificaciones

**Causa**: El tipo `listing_answer` no existía en el ENUM de PostgreSQL.

**Solución**:
1. Ejecutar `supabase_notifications_enum_extend.sql` para agregar el nuevo tipo
2. O usar `insertNotificationBestEffort` que maneja fallbacks automáticamente

**Prevención**:
- Siempre usar `insertNotificationBestEffort` para insertar notificaciones
- Esta función maneja automáticamente variaciones de schema

---

### Problema 6: `column notifications.message does not exist`

**Error**:
```
42703: column notifications.message does not exist
```

**Causa**: El schema usa `body` en lugar de `message`.

**Solución**:
- El código ya maneja esto automáticamente en `insertNotificationBestEffort`
- Si falla con `body`, intenta con `message` como fallback

**Nota**: El schema correcto usa `body`, no `message`.

---

### Problema 7: Tabla de notificaciones no existe

**Error**:
```
42P01: relation "public.notifications" does not exist
```

**Causa**: No se ejecutó el script SQL inicial.

**Solución**:
1. Ejecutar `supabase_notifications.sql` en Supabase → SQL Editor
2. Verificar que la tabla se creó: `SELECT * FROM information_schema.tables WHERE table_name = 'notifications'`

---

## 🔔 Problemas de Notificaciones

### Problema 8: Notificaciones no llegan cuando el vendedor responde preguntas

**Síntomas**:
- El vendedor responde una pregunta
- El comprador no recibe notificación
- El punto rosa no se ilumina

**Causa**: 
1. Falta el trigger en la base de datos
2. El tipo `listing_answer` no existe en el ENUM

**Solución**:
1. Ejecutar `supabase_notifications_triggers.sql` (incluye el trigger `trg_notify_asker_on_question_answer`)
2. Ejecutar `supabase_notifications_enum_extend.sql` para agregar el tipo
3. Verificar que `insertNotificationBestEffort` esté siendo usado

**Código del trigger**:
```sql
CREATE OR REPLACE FUNCTION public.notify_asker_on_question_answer()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.answer_text IS NULL) AND (NEW.answer_text IS NOT NULL) THEN
      -- Insertar notificación para el asker
      INSERT INTO public.notifications (...)
      VALUES (...);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

---

### Problema 9: Punto rosa de notificaciones no se ilumina

**Síntomas**:
- Hay notificaciones sin leer
- El punto rosa no aparece

**Causa**: 
1. `AccountTopMenu` estaba oculto en rutas del dashboard
2. El componente no estaba cargando las notificaciones

**Solución**:
- Modificar `components/AccountTopMenu.tsx` para que solo se oculte en rutas `/admin`, no en `/dashboard`
- Asegurar que el hook de notificaciones se ejecute correctamente

**Código corregido**:
```typescript
// ❌ ANTES (incorrecto)
if (pathname.startsWith('/dashboard')) return null;

// ✅ DESPUÉS (correcto)
if (pathname.startsWith('/admin')) return null;
```

---

### Problema 10: Notificaciones de admin no llegan a compradores sin perfil

**Síntomas**:
- Admin envía anuncio general
- Compradores sin `profiles` row no reciben notificación

**Causa**: La query solo buscaba usuarios con `profiles` existente.

**Solución**:
- Modificar la query para incluir usuarios sin perfil
- Usar LEFT JOIN o consultar directamente `auth.users`

---

## 🎨 Problemas de UI/UX

### Problema 11: Chat parpadea constantemente mostrando "Cargando..."

**Síntomas**:
- El chat muestra "Cargando..." cada 6 segundos
- Parpadea constantemente

**Causa**: El polling cada 6 segundos establecía `isLoading = true`, causando el parpadeo.

**Solución**:
- Separar `isInitialLoading` (solo para carga inicial) de las actualizaciones periódicas
- El polling ahora es "silencioso" (no muestra "Cargando...")

**Código corregido**:
```typescript
// ❌ ANTES (incorrecto)
const [isLoading, setIsLoading] = useState(false);
const load = async () => {
  setIsLoading(true); // Esto causaba parpadeo
  // ...
  setIsLoading(false);
};

// ✅ DESPUÉS (correcto)
const [isInitialLoading, setIsInitialLoading] = useState(true);
const load = async (isInitial = false) => {
  if (isInitial) setIsInitialLoading(true);
  // ...
  if (isInitial) setIsInitialLoading(false);
};
```

---

### Problema 12: Filtros de ventas no funcionan correctamente

**Síntomas**:
- Los filtros no muestran las órdenes correctas
- Contadores incorrectos

**Causa**: 
1. La lógica de filtrado no consideraba todos los casos
2. No se usaba `useMemo` para optimizar

**Solución**:
- Implementar `useMemo` para filtros y contadores
- Mejorar la lógica de cada filtro
- Agregar contadores visuales en los botones

---

### Problema 13: Estado "pending_payment" se muestra como texto técnico

**Síntomas**:
- Se muestra "pending_payment" en lugar de texto amigable

**Solución**:
- Agregar mapeo de estados a texto en español
- Agregar colores distintivos (rojo para pendiente, verde para pagado, etc.)

**Código**:
```typescript
{status === 'pending_payment' ? (
  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
    Pendiente de pago
  </span>
) : status === 'paid' ? (
  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-green-200">
    Pagado
  </span>
) : ...}
```

---

## 💬 Problemas de Chat/Tiempo Real

### Problema 14: Chat no se actualiza en tiempo real

**Síntomas**:
- Los mensajes no aparecen hasta refrescar
- No hay actualizaciones automáticas

**Causa**: 
1. Realtime no estaba configurado correctamente
2. Las suscripciones no se establecían

**Solución**:
- Implementar suscripciones de Supabase Realtime
- Agregar polling como fallback
- Usar broadcast channels para notificaciones cross-client

**Código**:
```typescript
// Suscripción a cambios en tiempo real
useEffect(() => {
  const channel = supabase
    .channel('support:events')
    .on('broadcast', { event: 'support_event' }, (payload) => {
      // Actualizar mensajes
    })
    .subscribe();
  
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## 📝 Notas Generales

### Mejores Prácticas Aprendidas

1. **Siempre usar `Array.from()` para iterar sobre Sets/Iterators**
2. **Usar `insertNotificationBestEffort` para todas las notificaciones**
3. **Separar estados de carga inicial vs. actualizaciones periódicas**
4. **Usar `useMemo` para cálculos costosos**
5. **Verificar que los scripts SQL se ejecuten en orden**
6. **Limpiar caché de Next.js cuando hay problemas**: `rm -rf .next`

### Comandos Útiles para Debugging

```bash
# Ver errores de compilación
npm run build

# Limpiar y reinstalar
rm -rf .next node_modules package-lock.json
npm install

# Ver logs del servidor
npm run dev
# (revisar la consola donde corre el servidor)
```

---

**Última actualización**: Enero 2026
