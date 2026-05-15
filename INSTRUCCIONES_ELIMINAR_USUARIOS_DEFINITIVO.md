# ✅ Solución Definitiva: Eliminar Usuarios Permanentemente

## 🔍 Problema Identificado

Los usuarios **volvían a aparecer** después de eliminarlos porque:

1. El trigger `handle_new_user` recreaba automáticamente el perfil cuando se creaba un usuario en `auth.users`
2. El código anterior **solo eliminaba el perfil** de `profiles`, pero **NO eliminaba el usuario** de `auth.users`
3. Si el usuario todavía existía en `auth.users`, el trigger podía recrear el perfil

## ✅ Solución Implementada

### 1. Eliminación Completa de `auth.users`

Ahora el sistema elimina el usuario de **ambos lugares**:
- ✅ `profiles` (perfil del usuario)
- ✅ `auth.users` (usuario de autenticación) ← **NUEVO**

### 2. Trigger Modificado

El trigger `handle_new_user` ahora:
- ✅ Verifica si el usuario está marcado como `deleted` antes de crear el perfil
- ✅ No recrea perfiles de usuarios eliminados
- ✅ Previene duplicados

---

## 📋 Pasos para Activar la Solución

### Paso 1: Ejecutar SQL en Supabase

```sql
-- Ejecuta este archivo en Supabase SQL Editor:
SOLUCION_DEFINITIVA_ELIMINAR_USUARIOS.sql
```

**Esto modificará el trigger para prevenir recreación de perfiles eliminados.**

### Paso 2: Verificar que Funciona

1. **Elimina un usuario desde tu panel de admin**
2. **Verifica en Supabase:**
   ```sql
   -- Verificar que el perfil fue eliminado
   SELECT * FROM profiles WHERE id = 'user-id-aqui';
   -- Debería retornar 0 filas
   
   -- Verificar que el usuario fue eliminado de auth.users
   SELECT * FROM auth.users WHERE id = 'user-id-aqui';
   -- Debería retornar 0 filas (requiere permisos de admin)
   ```

3. **Intenta crear un usuario con el mismo email** (si es posible)
   - El trigger NO debería recrear el perfil si está marcado como eliminado

---

## 🔧 Cómo Usar la Eliminación

### Opción 1: Desde el Panel de Admin

1. Ve a `/admin/usuarios`
2. Selecciona el usuario
3. Haz click en **"Eliminar Cuenta"**
4. Confirma la eliminación

**El sistema ahora:**
- ✅ Elimina todas las publicaciones
- ✅ Elimina favoritos, cupones, notificaciones, carrito
- ✅ Elimina el perfil de `profiles`
- ✅ **Elimina el usuario de `auth.users`** ← NUEVO
- ✅ Marca como eliminado en `user_admin_states`

### Opción 2: Desde la API

```typescript
// POST /api/admin/users/delete-account
{
  "user_id": "uuid-del-usuario",
  "notes": "Razón de eliminación (opcional)"
}
```

### Opción 3: Usando el Módulo Centralizado

```typescript
import { executeUserAction } from '@/lib/admin/userManagement';

const result = await executeUserAction(admin, adminId, userId, 'delete', {
  notes: 'Razón de eliminación'
});
```

---

## 🛡️ Protecciones Implementadas

### 1. Verificación de Órdenes Activas

El sistema **NO permite eliminar** usuarios con órdenes activas:
- `paid` (pagadas)
- `shipped` (enviadas)
- `delivered` (entregadas)

**Mensaje de error:**
```
No se puede eliminar usuario con X orden(es) activa(s)
```

### 2. Protección de Administradores

El sistema **NO permite eliminar** cuentas de administrador.

**Mensaje de error:**
```
No se puede eliminar una cuenta de administrador
```

### 3. Prevención de Recreación

- ✅ El trigger verifica `user_admin_states.status = 'deleted'`
- ✅ Si está eliminado, NO crea el perfil
- ✅ Previene duplicados verificando si el perfil ya existe

---

## 🔍 Verificación Post-Eliminación

### Query SQL para Verificar Eliminación Completa

```sql
-- Verificar que el perfil fue eliminado
SELECT COUNT(*) as perfil_existe
FROM profiles 
WHERE id = 'user-id-aqui';
-- Debería retornar 0

-- Verificar que está marcado como eliminado
SELECT status, notes, updated_at
FROM user_admin_states
WHERE user_id = 'user-id-aqui';
-- Debería mostrar status = 'deleted'

-- Verificar que no tiene datos relacionados
SELECT 
  (SELECT COUNT(*) FROM favorites WHERE user_id = 'user-id-aqui') as favoritos,
  (SELECT COUNT(*) FROM listings WHERE seller_id = 'user-id-aqui') as publicaciones,
  (SELECT COUNT(*) FROM notifications WHERE user_id = 'user-id-aqui') as notificaciones;
-- Todos deberían ser 0
```

---

## 🐛 Solución de Problemas

### Problema: "Error eliminando usuario de auth.users"

**Causa:** Puede ser un problema de permisos o el usuario ya no existe.

**Solución:**
1. Verifica que tienes permisos de administrador
2. Verifica que el `SUPABASE_SERVICE_ROLE_KEY` está configurado correctamente
3. El sistema marcará el usuario como `deleted` en `user_admin_states` como respaldo

### Problema: "Usuario sigue apareciendo después de eliminarlo"

**Causa:** El SQL del trigger no se ejecutó o hay un error.

**Solución:**
1. Ejecuta `SOLUCION_DEFINITIVA_ELIMINAR_USUARIOS.sql` nuevamente
2. Verifica que el trigger fue modificado:
   ```sql
   SELECT proname, prosrc 
   FROM pg_proc 
   WHERE proname = 'handle_new_user';
   ```
3. Deberías ver código que verifica `user_admin_states.status = 'deleted'`

### Problema: "No puedo eliminar porque tiene órdenes activas"

**Causa:** El usuario tiene órdenes en estado `paid`, `shipped`, o `delivered`.

**Solución:**
1. Completa o cancela las órdenes primero
2. O modifica el estado de las órdenes a `cancelled` o `completed`
3. Luego intenta eliminar nuevamente

---

## 📝 Archivos Modificados

### Backend
- ✅ `lib/admin/userManagement.ts` - Ahora elimina de `auth.users`
- ✅ `app/api/admin/users/delete-account/route.ts` - Elimina de `auth.users`

### SQL
- ✅ `SOLUCION_DEFINITIVA_ELIMINAR_USUARIOS.sql` - Modifica trigger y crea funciones auxiliares

---

## ✅ Checklist de Verificación

Antes de considerar el problema resuelto:

- [ ] Ejecutado `SOLUCION_DEFINITIVA_ELIMINAR_USUARIOS.sql` en Supabase
- [ ] Verificado que el trigger fue modificado
- [ ] Probado eliminar un usuario desde el panel
- [ ] Verificado que el perfil fue eliminado de `profiles`
- [ ] Verificado que el usuario fue eliminado de `auth.users` (si es posible)
- [ ] Verificado que está marcado como `deleted` en `user_admin_states`
- [ ] Probado que el usuario NO reaparece después de eliminarlo
- [ ] Verificado que no se puede eliminar administradores
- [ ] Verificado que no se puede eliminar usuarios con órdenes activas

---

## 🚀 Próximos Pasos

1. **Ejecutar SQL** en Supabase
2. **Probar eliminación** de un usuario de prueba
3. **Verificar** que no reaparece
4. **Monitorear logs** para errores

---

**¡La solución está implementada y lista para usar!** 🎉

**IMPORTANTE:** Después de ejecutar el SQL, los usuarios eliminados NO volverán a aparecer.
