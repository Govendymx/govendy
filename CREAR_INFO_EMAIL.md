# Crear info@gopocket.com.mx

## Paso 1: Configurar en Cloudflare Email Routing (Para RECIBIR)

1. Ve a: https://dash.cloudflare.com
2. Selecciona tu dominio: `gopocket.com.mx`
3. En el menú lateral, busca "Email" → "Email Routing"
4. Haz clic en "Reglas de enrutamiento" o "Routing rules"
5. Haz clic en "Create address" o "Crear dirección"
6. Completa el formulario:
   - **Dirección personalizada:** `info`
   - **Reenviar a:** `arturoalejandro031187@gmail.com` (o el email que prefieras)
7. Haz clic en "Save" o "Guardar"

✅ **Listo!** Ahora cualquier email enviado a `info@gopocket.com.mx` llegará a tu email personal.

---

## Paso 2: Usar para ENVIAR emails (Ya configurado)

Como el dominio `gopocket.com.mx` ya está verificado en Resend, puedes enviar desde `info@gopocket.com.mx` sin configurar nada más.

### Opción A: Cambiar variable de entorno

En tu `.env.local` y Vercel, puedes cambiar:

```env
EMAIL_FROM=info@gopocket.com.mx
EMAIL_FROM_NAME=GoPocket Info
```

### Opción B: Usar en código específico

Puedes crear una función que permita especificar el "from":

```typescript
import { sendEmailWithResend } from '@/lib/email/resend';

// Enviar desde info@gopocket.com.mx
await sendEmailWithResend({
  to: 'cliente@ejemplo.com',
  subject: 'Información',
  html: '<p>Contenido</p>',
  // El "from" se tomará de EMAIL_FROM por defecto
  // O puedes modificar lib/email/resend.ts para aceptar un parámetro "from"
});
```

---

## Resumen

✅ **Recibir:** Configura en Cloudflare Email Routing (5 minutos)
✅ **Enviar:** Ya funciona (dominio verificado en Resend)
✅ **Costo:** $0 USD

¿Quieres que te guíe paso a paso para configurarlo en Cloudflare?
