# Configurar Email con Cloudflare Email Routing

## Paso 1: Activar Email Routing en Cloudflare

1. **Inicia sesión en Cloudflare:**
   - Ve a https://dash.cloudflare.com
   - Inicia sesión con tu cuenta

2. **Selecciona tu dominio:**
   - En el dashboard, haz clic en tu dominio

3. **Activa Email Routing:**
   - En el menú lateral, busca **"Email"** → **"Email Routing"**
   - Haz clic en **"Get Started"** o **"Activate Email Routing"**
   - Cloudflare configurará automáticamente los registros DNS necesarios

## Paso 2: Crear tu primera dirección de email

1. **Ve a "Email Routing" → "Addresses":**
   - Haz clic en **"Create address"**

2. **Configura la dirección:**
   - **Email address:** `contacto@tudominio.com` (o el que prefieras)
   - **Destination address:** Tu email personal (Gmail, Outlook, etc.)
   - Ejemplo: `tu-email@gmail.com`

3. **Crea la dirección:**
   - Haz clic en **"Create"**
   - ¡Listo! Los emails a `contacto@tudominio.com` se reenviarán a tu Gmail

## Paso 3: Verificar que funciona

1. **Envía un email de prueba:**
   - Desde cualquier email, envía a `contacto@tudominio.com`
   - Debería llegar a tu email personal en unos minutos

2. **Verifica en Cloudflare:**
   - Ve a **"Email Routing" → "Addresses"**
   - Deberías ver tu dirección creada y activa

## Paso 4: Crear más direcciones (opcional)

Puedes crear direcciones ilimitadas:
- `info@tudominio.com` → tu-email@gmail.com
- `ventas@tudominio.com` → tu-email@gmail.com
- `soporte@tudominio.com` → tu-email@gmail.com
- `noreply@tudominio.com` → tu-email@gmail.com

**Todas se reenviarán a tu email personal.**

## Paso 5: Configurar Catch-All (opcional)

Un catch-all captura TODOS los emails que no tienen dirección específica:

1. En **"Email Routing" → "Addresses"**
2. Haz clic en **"Create address"**
3. Crea: `*@tudominio.com` (con asterisco)
4. Destino: tu email personal
5. Ahora cualquier email como `cualquiercosa@tudominio.com` llegará a ti

## ⚠️ Importante: Para ENVIAR emails

Cloudflare Email Routing **solo recibe y reenvía**. Para ENVIAR emails desde tu dominio, necesitas:

### Opción A: Resend (Recomendado - Gratis hasta 3,000/mes)

1. **Crea cuenta:** https://resend.com
2. **Verifica tu dominio:**
   - Agrega los registros DNS que Resend te da
   - Espera verificación (puede tardar minutos)
3. **Usa en tu app:**
   ```typescript
   // Instalar: npm install resend
   import { Resend } from 'resend';
   
   const resend = new Resend(process.env.RESEND_API_KEY);
   
   await resend.emails.send({
     from: 'contacto@tudominio.com',
     to: 'cliente@ejemplo.com',
     subject: 'Hola',
     html: '<p>Mensaje</p>',
   });
   ```

### Opción B: Mailgun (Gratis hasta 5,000/mes)

1. **Crea cuenta:** https://mailgun.com
2. **Verifica tu dominio:**
   - Agrega registros DNS
3. **Usa con Nodemailer** (ya lo tienes instalado):
   ```typescript
   import nodemailer from 'nodemailer';
   
   const transporter = nodemailer.createTransport({
     host: 'smtp.mailgun.org',
     port: 587,
     auth: {
       user: process.env.MAILGUN_USER,
       pass: process.env.MAILGUN_PASS,
     },
   });
   
   await transporter.sendMail({
     from: 'contacto@tudominio.com',
     to: 'cliente@ejemplo.com',
     subject: 'Hola',
     html: '<p>Mensaje</p>',
   });
   ```

## Configuración para tu App Pocket-App

### Variables de entorno necesarias:

```env
# Para Resend
RESEND_API_KEY=re_xxxxxxxxxxxxx

# O para Mailgun
MAILGUN_API_KEY=xxxxxxxxxxxxx
MAILGUN_DOMAIN=tudominio.com
MAILGUN_USER=postmaster@tudominio.com
MAILGUN_PASS=xxxxxxxxxxxxx
```

### Ejemplo de uso en tu app:

Ya tienes `nodemailer` instalado, así que puedes crear un endpoint:

```typescript
// app/api/send-email/route.ts
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com', // o smtp.mailgun.org
    port: 587,
    auth: {
      user: 'resend', // o tu usuario de Mailgun
      pass: process.env.RESEND_API_KEY, // o MAILGUN_PASS
    },
  });
  
  await transporter.sendMail({
    from: 'contacto@tudominio.com',
    to: 'destino@ejemplo.com',
    subject: 'Asunto',
    html: '<p>Contenido</p>',
  });
  
  return NextResponse.json({ ok: true });
}
```

## Resumen

✅ **Recibir emails:** Cloudflare Email Routing (GRATIS)
✅ **Enviar emails:** Resend o Mailgun (GRATIS hasta cierto límite)
✅ **Ilimitadas direcciones** para recibir
✅ **Fácil de configurar**

## Costos

- **Cloudflare Email Routing:** GRATIS
- **Resend:** GRATIS hasta 3,000 emails/mes
- **Mailgun:** GRATIS hasta 5,000 emails/mes

**Total: $0 USD para empezar** 🎉

¿Quieres que te ayude a integrar el envío de emails en tu app Pocket-App?
