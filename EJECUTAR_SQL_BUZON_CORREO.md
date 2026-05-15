# 📧 Ejecutar SQL para Buzón de Correo

## 📍 Ubicación del archivo

El archivo `supabase_admin_mailboxes.sql` está en la **raíz de tu proyecto**:
```
C:\Users\ALEJANDRO\Documents\Pocket-App\supabase_admin_mailboxes.sql
```

## 🚀 Cómo ejecutarlo en Supabase

### Paso 1: Abrir Supabase
1. Ve a https://supabase.com
2. Inicia sesión en tu cuenta
3. Selecciona tu proyecto **GoPocket**

### Paso 2: Abrir SQL Editor
1. En el menú lateral izquierdo, busca **"SQL Editor"**
2. Haz clic en **"SQL Editor"** o **"New query"**

### Paso 3: Copiar y pegar el SQL
Copia y pega este código SQL:

```sql
-- Buzón de correo admin: 2–3 cuentas con dominio propio (IMAP + SMTP)
-- Ejecuta en Supabase → SQL Editor

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

### Paso 4: Ejecutar
1. Haz clic en el botón **"Run"** o presiona `Ctrl + Enter`
2. Deberías ver un mensaje de éxito: ✅ "Success. No rows returned"

### Paso 5: Verificar
Si ya estaba ejecutado, verás un mensaje indicando que la columna ya existe (eso está bien).

## ✅ Listo

Una vez ejecutado, ya puedes:
1. Ir a **Admin → Configuración** en tu app
2. Buscar la sección **"Buzón de correo"**
3. Configurar tus cuentas de correo

## 📝 Nota

Este SQL es **seguro de ejecutar múltiples veces**. Si la columna ya existe, simplemente no hará nada.
