# Configurar Email con Cloudflare - Guía Paso a Paso

## Tu Dominio: gopocket.com.mx

## Paso 1: Acceder a Email Routing

Desde tu dashboard de Cloudflare:

1. **Haz clic en tu dominio `gopocket.com.mx`** (no en el menú de 3 puntos)
2. En el menú lateral izquierdo, busca la sección **"Email"**
3. Haz clic en **"Email Routing"**
4. Si no lo ves, busca en el menú lateral bajo "Proteger y conectar" o "Desarrollo"

## Paso 2: Activar Email Routing

1. En la página de Email Routing, verás un botón **"Get Started"** o **"Activate Email Routing"**
2. Haz clic en activar
3. Cloudflare configurará automáticamente los registros DNS necesarios
4. Espera unos minutos mientras se configuran (puede tardar hasta 10 minutos)

## Paso 3: Crear tu primera dirección de email

1. Una vez activado, ve a la pestaña **"Addresses"** o **"Direcciones"**
2. Haz clic en **"Create address"** o **"Crear dirección"**
3. Completa:
   - **Email address:** `contacto@gopocket.com.mx`
   - **Destination address:** Tu email personal (ej: `tu-email@gmail.com`)
4. Haz clic en **"Create"** o **"Crear"**

## Paso 4: Verificar que funciona

1. Espera 5-10 minutos para que se propague la configuración
2. Envía un email de prueba a `contacto@gopocket.com.mx` desde cualquier cuenta
3. Debería llegar a tu email personal en unos minutos

## Direcciones útiles que puedes crear

- `contacto@gopocket.com.mx` → tu-email@gmail.com
- `info@gopocket.com.mx` → tu-email@gmail.com
- `ventas@gopocket.com.mx` → tu-email@gmail.com
- `soporte@gopocket.com.mx` → tu-email@gmail.com
- `noreply@gopocket.com.mx` → tu-email@gmail.com (para emails automáticos)

## Configurar Catch-All (opcional)

Para capturar TODOS los emails que no tengan dirección específica:

1. Crea una dirección: `*@gopocket.com.mx` (con asterisco)
2. Destino: tu email personal
3. Ahora cualquier email como `cualquiercosa@gopocket.com.mx` llegará a ti

## ⚠️ Para ENVIAR emails desde tu app

Cloudflare Email Routing **solo recibe**. Para enviar, necesitas:

### Opción Recomendada: Resend

1. **Crea cuenta:** https://resend.com (gratis hasta 3,000 emails/mes)
2. **Verifica tu dominio:**
   - En Resend, ve a "Domains" → "Add Domain"
   - Ingresa: `gopocket.com.mx`
   - Resend te dará registros DNS para agregar en Cloudflare
3. **Agrega los registros en Cloudflare:**
   - Ve a tu dominio en Cloudflare
   - "DNS" → "Records" → "Add record"
   - Agrega los registros que Resend te da
4. **Espera verificación** (puede tardar minutos)
5. **Obtén tu API Key** de Resend
6. **Úsalo en tu app**

### Variables de entorno para tu app:

```env
# Agregar a .env.local
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

### Código para tu app (ya tienes nodemailer):

```typescript
// app/api/send-email/route.ts
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  const { to, subject, html } = await req.json();
  
  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 587,
    secure: false,
    auth: {
      user: 'resend',
      pass: process.env.RESEND_API_KEY,
    },
  });
  
  await transporter.sendMail({
    from: 'contacto@gopocket.com.mx',
    to,
    subject,
    html,
  });
  
  return NextResponse.json({ ok: true });
}
```

## Resumen Rápido

✅ **Recibir:** Cloudflare Email Routing (GRATIS)
✅ **Enviar:** Resend (GRATIS hasta 3,000/mes)
✅ **Tu dominio:** gopocket.com.mx
✅ **Costo total:** $0 USD

## Ubicación en Cloudflare

Si no encuentras "Email Routing" en el menú:
1. Haz clic directamente en `gopocket.com.mx`
2. Busca en el menú lateral izquierdo
3. Puede estar bajo:
   - "Email" (directo)
   - "Proteger y conectar" → "Email"
   - O usa la búsqueda rápida (Ctrl+K) y busca "email"

¿Necesitas ayuda para encontrar la opción de Email Routing en tu dashboard?
