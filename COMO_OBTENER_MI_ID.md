# 📋 Cómo Obtener tu User ID

## Método 1: Desde la Consola del Navegador (MÁS FÁCIL)

1. **Abre tu aplicación** en el navegador (http://localhost:3002 o el puerto que uses)
2. **Abre la consola del navegador**:
   - Presiona `F12` o `Ctrl+Shift+I` (Windows/Linux)
   - O `Cmd+Option+I` (Mac)
3. **Ve a la pestaña "Console"**
4. **Ejecuta este comando:**
   ```javascript
   const { data } = await supabase.auth.getUser();
   console.log('Mi User ID:', data.user?.id);
   ```
5. **Copia el ID** que aparece (será algo como: `123e4567-e89b-12d3-a456-426614174000`)

## Método 2: Desde la Página de Preguntas

1. **Ve a** `/dashboard/preguntas` en tu aplicación
2. **Abre la consola del navegador** (F12)
3. **Busca en los logs** cualquier mensaje que contenga `sellerId` o `userId`
4. **El ID aparecerá en los logs** del servidor o del frontend

## Método 3: Desde Supabase Dashboard

1. **Abre Supabase Dashboard** → Authentication → Users
2. **Busca tu email** en la lista de usuarios
3. **Haz clic en tu usuario**
4. **Copia el UUID** que aparece en la parte superior

---

## ✅ Una vez que tengas tu ID:

1. **Abre** `VER_PREGUNTAS_SIMPLE.sql`
2. **Reemplaza** `'TU_USER_ID_AQUI'` con tu ID real
3. **Ejecuta** el script en Supabase SQL Editor

---

## 🚀 Solución Rápida: Eliminar Preguntas con Fechas Futuras

Si ya tienes tu ID, ejecuta esto en Supabase SQL Editor (reemplaza `'TU_USER_ID_AQUI'`):

```sql
UPDATE public.listing_questions
SET is_deleted = true
WHERE (
  seller_id = 'TU_USER_ID_AQUI'::uuid
  OR listing_id IN (
    SELECT id FROM public.listings WHERE seller_id = 'TU_USER_ID_AQUI'::uuid
  )
)
AND is_deleted = false
AND created_at > NOW();
```

Esto eliminará todas las preguntas con fechas futuras de tu cuenta.
