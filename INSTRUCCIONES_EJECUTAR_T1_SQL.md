# Instrucciones para Ejecutar el Script SQL de T1 Envíos

## 📋 Pasos para Ejecutar

### 1. Abre Supabase Dashboard
- Ve a: https://supabase.com/dashboard
- Inicia sesión con tu cuenta
- Selecciona tu proyecto

### 2. Abre el SQL Editor
- En el menú lateral, haz clic en **"SQL Editor"** (o **"SQL"**)
- Haz clic en **"New query"** o **"Nueva consulta"**

### 3. Copia y Pega el Script
Copia el siguiente código SQL:

```sql
-- Agregar configuración de T1 Envíos a app_settings
-- Ejecuta este SQL en Supabase SQL Editor

DO $$
BEGIN
  -- Agregar columna para configuración de T1 Envíos (JSONB)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'app_settings' 
    AND column_name = 't1_envios_config'
  ) THEN
    ALTER TABLE public.app_settings
    ADD COLUMN t1_envios_config JSONB DEFAULT jsonb_build_object(
      'enabled', false,
      'api_key', '',
      'api_secret', '',
      'endpoint_url', '',
      'test_mode', true
    );
  END IF;
END$$;

-- Comentario sobre la estructura
COMMENT ON COLUMN public.app_settings.t1_envios_config IS 'Configuración de T1 Envíos: {enabled: boolean, api_key: string, api_secret: string, endpoint_url: string, test_mode: boolean}';
```

### 4. Ejecuta el Script
- Haz clic en el botón **"Run"** (o **"Ejecutar"**) o presiona `Ctrl + Enter`
- Espera a que aparezca el mensaje de éxito: **"Success. No rows returned"**

### 5. Verifica que se Ejecutó Correctamente
Ejecuta esta consulta para verificar:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'app_settings' 
AND column_name = 't1_envios_config';
```

Deberías ver una fila con:
- `column_name`: `t1_envios_config`
- `data_type`: `jsonb`

## ✅ Listo

Una vez ejecutado, podrás:
1. Ir a `/admin/settings` en tu aplicación
2. Ver la nueva sección "Integración T1 Envíos"
3. Configurar las credenciales cuando las tengas

## 🔍 Si Hay Errores

Si aparece algún error, puede ser porque:
- La tabla `app_settings` no existe (ejecuta primero `supabase_admin_and_settings.sql`)
- Ya existe la columna (el script es idempotente, no debería dar error)

En cualquier caso, el script está diseñado para ser seguro y no debería causar problemas si se ejecuta múltiples veces.
