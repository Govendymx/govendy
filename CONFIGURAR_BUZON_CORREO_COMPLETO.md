# Configurar Buzón de Correo Completo - Guía Paso a Paso

## ✅ Lo que ya tienes implementado

Tu app ya tiene:
- ✅ Sistema de buzón de correo completo
- ✅ Ver correos entrantes (IMAP)
- ✅ Enviar correos (SMTP)
- ✅ Responder correos directamente
- ✅ Hasta 4 cuentas configuradas

## 📋 Paso 1: Ejecutar migración SQL (si no está hecha)

1. Ve a **Supabase Dashboard** → Tu proyecto → **SQL Editor**
2. Ejecuta este SQL:

```sql
-- Buzón de correo admin: 2–3 cuentas con dominio propio (IMAP + SMTP)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'admin_mailboxes'
  ) THEN
    ALTER TABLE public.app_settings
      ADD COLUMN admin_mailboxes JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.app_settings.admin_mailboxes IS 'Buzón admin: array de {label, email, imap_host, imap_port, imap_secure, imap_user, imap_pass, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass}. Máx. 4 cuentas.';
```

## 📧 Paso 2: Configurar tus cuentas de correo

### Opción A: Usar Google Workspace (Recomendado)

Si tienes Google Workspace para `gopocket.com.mx`:

1. Ve a **Admin → Configuración** en tu app
2. Busca la sección **"Buzón de correo"**
3. Configura cada cuenta:

**Cuenta 1: Contacto**
- **Etiqueta:** `Contacto`
- **Email:** `contacto@gopocket.com.mx`
- **IMAP Host:** `imap.gmail.com`
- **IMAP Puerto:** `993`
- **IMAP SSL:** ✅ (activado)
- **IMAP Usuario:** `contacto@gopocket.com.mx`
- **IMAP Contraseña:** [Contraseña de aplicación de Google]
- **SMTP Host:** `smtp.gmail.com`
- **SMTP Puerto:** `587`
- **SMTP SSL:** ✅ (activado)
- **SMTP Usuario:** `contacto@gopocket.com.mx`
- **SMTP Contraseña:** [Contraseña de aplicación de Google]

**Cuenta 2: Info**
- **Etiqueta:** `Info`
- **Email:** `info@gopocket.com.mx`
- [Misma configuración que Contacto, pero con `info@gopocket.com.mx`]

**Cuenta 3: Ventas**
- **Etiqueta:** `Ventas`
- **Email:** `ventas@gopocket.com.mx`
- [Misma configuración que Contacto, pero con `ventas@gopocket.com.mx`]

### Opción B: Usar Zoho Mail (Gratis)

Si usas Zoho Mail:

1. Ve a **Admin → Configuración** en tu app
2. Configura cada cuenta:

**Para todas las cuentas:**
- **IMAP Host:** `imap.zoho.com`
- **IMAP Puerto:** `993`
- **IMAP SSL:** ✅
- **SMTP Host:** `smtp.zoho.com`
- **SMTP Puerto:** `587`
- **SMTP SSL:** ✅

### Opción C: Usar cPanel / Hosting tradicional

Si tu dominio está en cPanel o hosting tradicional:

1. Consulta con tu proveedor de hosting los datos IMAP/SMTP
2. Generalmente son:
   - **IMAP Host:** `mail.tudominio.com` o `imap.tudominio.com`
   - **IMAP Puerto:** `993` (SSL) o `143` (sin SSL)
   - **SMTP Host:** `mail.tudominio.com` o `smtp.tudominio.com`
   - **SMTP Puerto:** `587` (TLS) o `465` (SSL)

## 🔐 Paso 3: Obtener contraseñas de aplicación (Google Workspace)

Si usas Google Workspace, necesitas crear una **contraseña de aplicación**:

1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. **Seguridad** → **Verificación en 2 pasos** (debe estar activada)
3. **Contraseñas de aplicaciones**
4. Selecciona **"Correo"** y **"Otro (nombre personalizado)"**
5. Escribe: `GoPocket App`
6. Haz clic en **"Generar"**
7. **Copia la contraseña de 16 caracteres** (la usarás en lugar de tu contraseña normal)

⚠️ **Importante:** Usa esta contraseña de aplicación en los campos de contraseña IMAP y SMTP.

## 📱 Paso 4: Usar el buzón de correo

1. Ve a **Admin → Correo** en tu app
2. Selecciona la cuenta en el desplegable
3. Verás la lista de correos recibidos
4. Haz clic en un correo para leerlo
5. Usa el botón **"Responder"** para responder directamente
6. O usa **"Redactar"** para escribir un correo nuevo

## ✨ Funcionalidades disponibles

- ✅ Ver todos los correos entrantes
- ✅ Leer correos completos (HTML y texto)
- ✅ Responder correos directamente (botón "Responder")
- ✅ Redactar nuevos correos
- ✅ Enviar desde cualquier cuenta configurada
- ✅ Cambiar entre cuentas fácilmente

## 🔍 Verificar que funciona

1. Envía un correo de prueba a `contacto@gopocket.com.mx`
2. Ve a **Admin → Correo** en tu app
3. Selecciona la cuenta "Contacto"
4. Deberías ver el correo en la lista
5. Haz clic para leerlo
6. Prueba responder

## ⚠️ Solución de problemas

### "Error al cargar buzón"
- Verifica que IMAP esté habilitado en tu cuenta
- Verifica usuario y contraseña
- Verifica puerto y SSL

### "Error al enviar"
- Verifica que SMTP esté habilitado
- Verifica usuario y contraseña SMTP
- Verifica puerto y SSL/TLS

### "No hay correos"
- Espera unos minutos (puede haber delay)
- Verifica que los correos lleguen a tu cliente de correo normal
- Verifica la configuración IMAP

## 📝 Notas importantes

- Las contraseñas se guardan encriptadas en la base de datos
- Solo administradores pueden acceder al buzón
- Puedes configurar hasta 4 cuentas
- Los correos se leen directamente del servidor (no se guardan en la app)
