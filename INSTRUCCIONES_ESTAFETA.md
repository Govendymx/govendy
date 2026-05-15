# Sistema de Cotización y Venta de Guías Estafeta

## Archivos SQL a Ejecutar

Ejecuta estos archivos SQL en Supabase SQL Editor en el siguiente orden:

1. **CREAR_TABLA_ESTAFETA_QUOTES.sql** - Crea la tabla para almacenar cotizaciones y compras de guías
2. **AGREGAR_CONFIG_ESTAFETA.sql** - Agrega la columna de configuración de precios Estafeta a `app_settings`

## Logo de Estafeta

El sistema busca el logo en `/public/estafeta-logo.png`. Si no existe, se mostrará un icono SVG de camión como fallback.

Para agregar el logo:
1. Coloca el archivo `estafeta-logo.png` en la carpeta `public/`
2. El sistema lo detectará automáticamente

## Flujo Completo

### Para Usuarios:
1. **Cotización**: El usuario accede desde el card "Tienda Estafeta Cotiza tus envios" en la página principal
2. **Formulario**: Completa datos del paquete (peso, medidas) y direcciones (remitente y destinatario)
3. **Cálculo**: El sistema calcula el costo basado en la configuración del admin
4. **Pago**: El usuario paga con MercadoPago
5. **Notificación**: Recibe notificación cuando el admin sube la guía
6. **Descarga**: Ve la guía en su panel de compras con mensaje "¡Gracias por tu compra!"

### Para Administradores:
1. **Panel**: Accede a `/admin/estafeta` desde el menú de admin
2. **Ver ventas**: Ve todas las cotizaciones pagadas con todos los datos
3. **Descargar datos**: Puede descargar un archivo .txt con todos los datos de cada cotización
4. **Subir guía**: Sube el archivo PDF/imagen de la guía generada
5. **Marcar estados**: Puede marcar como "procesando" y luego "completada"
6. **Configuración**: Ajusta precios en `/admin/settings` en la sección "Configuración Estafeta"

## Configuración de Precios

En `/admin/settings`, sección "Configuración Estafeta":
- **Precio base fijo**: Costo base independiente del peso
- **Precio por kg**: Costo por cada kilogramo
- **Precio por kg adicional**: Costo por kg después del primero
- **Peso mínimo/máximo**: Límites de peso permitidos
- **Habilitar/deshabilitar**: Toggle para activar/desactivar el servicio

## Estados de Cotización

- `quote`: Solo cotización (sin datos completos)
- `pending_payment`: Pendiente de pago
- `paid`: Pagada (esperando que admin suba guía)
- `processing`: Procesando (admin subió guía, marcando como procesando)
- `completed`: Completada (guía lista para descarga)
- `cancelled`: Cancelada

## Notificaciones

El sistema envía notificaciones automáticas:
- Cuando se acredita el pago: "Pago de guía Estafeta acreditado"
- Cuando el admin sube la guía: "Tu guía Estafeta está lista"

## Archivos Creados

### Frontend:
- `app/estafeta/cotizar/page.tsx` - Página de cotización
- `app/admin/estafeta/page.tsx` - Panel admin para gestionar guías
- `app/dashboard/compras/page.tsx` - Actualizado para mostrar guías Estafeta

### Backend (APIs):
- `app/api/estafeta/calculate/route.ts` - Calcula costo y crea cotización
- `app/api/estafeta/update-quote/route.ts` - Actualiza cotización con datos completos
- `app/api/estafeta/create-payment/route.ts` - Crea preferencia de pago MercadoPago
- `app/api/admin/estafeta/list/route.ts` - Lista cotizaciones para admin
- `app/api/admin/estafeta/upload-guide/route.ts` - Sube guía y notifica al usuario
- `app/api/admin/estafeta/mark-processing/route.ts` - Marca como procesando
- `app/api/admin/estafeta/mark-completed/route.ts` - Marca como completada

### SQL:
- `CREAR_TABLA_ESTAFETA_QUOTES.sql` - Tabla principal
- `AGREGAR_CONFIG_ESTAFETA.sql` - Configuración en app_settings

### Otros:
- `app/page.tsx` - Actualizado card "Ingresa a tu cuenta" → "Tienda Estafeta Cotiza tus envios"
- `app/api/mercadopago/webhook/route.ts` - Actualizado para manejar pagos Estafeta
- `app/admin/settings/page.tsx` - Agregada sección de configuración Estafeta
- `app/admin/metricas/page.tsx` - Agregado link a panel Estafeta
- `app/compra-exitosa/page.tsx` - Actualizado para mensaje de Estafeta

## Próximos Pasos

1. Ejecutar los archivos SQL en Supabase
2. Agregar logo de Estafeta en `public/estafeta-logo.png` (opcional, hay fallback)
3. Configurar precios en `/admin/settings`
4. Probar el flujo completo
