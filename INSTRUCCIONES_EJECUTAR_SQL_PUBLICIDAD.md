# Instrucciones para Ejecutar el SQL del Sistema de Publicidad

## Paso 1: Abrir Supabase SQL Editor

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. En el menú lateral izquierdo, haz clic en **"SQL Editor"** (o "Editor SQL")

## Paso 2: Ejecutar el Script

1. Haz clic en **"New query"** (Nueva consulta) o en el botón **"+"**
2. Abre el archivo `supabase_advertising_system.sql` desde tu proyecto
3. Copia TODO el contenido del archivo
4. Pégalo en el editor SQL de Supabase
5. Haz clic en **"Run"** (Ejecutar) o presiona `Ctrl + Enter` (Windows) / `Cmd + Enter` (Mac)

## Paso 3: Verificar que se Ejecutó Correctamente

Deberías ver un mensaje de éxito. Si hay algún error, verifica:

- Que no hayas ejecutado el script antes (algunas tablas pueden ya existir)
- Que tengas permisos de administrador en Supabase
- Revisa los mensajes de error específicos

## Paso 4: Verificar las Tablas Creadas

1. Ve a **"Table Editor"** en el menú lateral
2. Deberías ver las siguientes tablas nuevas:
   - `ad_campaigns`
   - `ad_payments`
   - `verification_payments`
   - `ad_stats`

## Paso 5: Configurar el Precio de Verificación

1. Ve a tu aplicación: `/admin/settings`
2. Busca el campo **"Precio de verificación (MXN)"**
3. Establece el precio que quieras (por defecto es $50)
4. Haz clic en **"Guardar"**

## ¡Listo!

Ahora el sistema de publicidad y verificación de pago está completamente funcional:

- ✅ Los usuarios pueden crear campañas publicitarias
- ✅ Los administradores pueden aprobar/rechazar campañas
- ✅ La verificación ahora requiere pago
- ✅ Todo se conecta automáticamente con MercadoPago

## Notas Importantes

- El script SQL es **idempotente** (se puede ejecutar múltiples veces sin problemas)
- Si alguna tabla ya existe, el script la omitirá
- Los índices y políticas RLS se crearán o actualizarán según sea necesario
