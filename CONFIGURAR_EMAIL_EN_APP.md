# Configurar contacto@gopocket.com.mx en tu App

## Paso 1: Configurar Resend (Recomendado - GRATIS)

### 1.1 Crear cuenta en Resend

1. Ve a https://resend.com
2. Crea una cuenta (gratis)
3. Verifica tu email

### 1.2 Verificar tu dominio en Resend

1. En Resend, ve a **"Domains"** → **"Add Domain"**
2. Ingresa: `gopocket.com.mx`
3. Resend te dará registros DNS para agregar

### 1.3 Agregar registros DNS en Cloudflare

1. Ve a Cloudflare → tu dominio `gopocket.com.mx`
2. Ve a **"DNS"** → **"Records"**
3. Haz clic en **"Add record"**
4. Agrega los registros que Resend te proporciona:
   - Registros TXT (para verificación)
   - Registros CNAME (si los requiere)
5. Espera la verificación (puede tardar 5-30 minutos)

### 1.4 Obtener tu API Key

1. En Resend, ve a **"API Keys"**
2. Haz clic en **"Create API Key"**
3. Copia la clave (empieza con `re_`)
4. **Guárdala** - solo se muestra una vez

---

## Paso 2: Configurar en tu App

### 2.1 Agregar variable de entorno

Abre tu archivo `.env.local` y agrega:

```env
# Email con Resend
RESEND_API_KEY=re_tu_clave_aqui
EMAIL_FROM=contacto@gopocket.com.mx
EMAIL_FROM_NAME=GoPocket
```

### 2.2 Actualizar Vercel

1. Ve a tu proyecto en Vercel
2. **Settings** → **Environment Variables**
3. Agrega:
   - `RESEND_API_KEY` = `re_tu_clave_aqui`
   - `EMAIL_FROM` = `contacto@gopocket.com.mx`
   - `EMAIL_FROM_NAME` = `GoPocket`
4. Haz clic en **"Save"**

---

## Paso 3: Crear función para enviar emails

Voy a crear un archivo nuevo que uses `contacto@gopocket.com.mx`:

```typescript
// lib/email/resend.ts
import nodemailer from 'nodemailer';

/**
 * Envía email usando Resend con contacto@gopocket.com.mx
 */
export async function sendEmailWithResend(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[EMAIL] RESEND_API_KEY no configurado');
    return { ok: false, error: 'RESEND_API_KEY no configurado' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: apiKey,
      },
    });

    await transporter.sendMail({
      from: `${process.env.EMAIL_FROM_NAME || 'GoPocket'} <${process.env.EMAIL_FROM || 'contacto@gopocket.com.mx'}>`,
      to: opts.to.trim(),
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      replyTo: opts.replyTo || process.env.EMAIL_FROM || 'contacto@gopocket.com.mx',
    });

    return { ok: true };
  } catch (e: unknown) {
    const err = e as Error;
    console.error('[EMAIL] Error enviando con Resend:', err);
    return { ok: false, error: err.message || 'Error al enviar email' };
  }
}
```

---

## Paso 4: Usar en tu app

### Ejemplo 1: En un endpoint API

```typescript
// app/api/contact/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithResend } from '@/lib/email/resend';

export async function POST(req: NextRequest) {
  try {
    const { name, email, message } = await req.json();
    
    // Enviar email de contacto
    const result = await sendEmailWithResend({
      to: 'contacto@gopocket.com.mx', // O tu email personal
      subject: `Nuevo contacto de ${name}`,
      html: `
        <h2>Nuevo mensaje de contacto</h2>
        <p><strong>Nombre:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${message}</p>
      `,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'Email enviado' });
  } catch (e) {
    return NextResponse.json({ error: 'Error al procesar' }, { status: 500 });
  }
}
```

### Ejemplo 2: En notificaciones existentes

Puedes actualizar `lib/email/send.ts` para usar Resend como alternativa:

```typescript
// Agregar al inicio del archivo
import { sendEmailWithResend } from './resend';

// En la función sendTransactionalEmail, agregar fallback:
export async function sendTransactionalEmail(opts: SendTransactionalOptions): Promise<{ ok: boolean; error?: string }> {
  // Intentar primero con Resend si está configurado
  if (process.env.RESEND_API_KEY) {
    const resendResult = await sendEmailWithResend(opts);
    if (resendResult.ok) return resendResult;
    // Si falla, continuar con el método anterior
  }
  
  // ... resto del código existente
}
```

---

## Paso 5: Probar que funciona

### Crear endpoint de prueba

```typescript
// app/api/test-email/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendEmailWithResend } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { to } = await req.json();
    
    const result = await sendEmailWithResend({
      to: to || 'arturoalejandro031187@gmail.com',
      subject: 'Prueba de email desde GoPocket',
      html: `
        <h1>¡Email funcionando!</h1>
        <p>Este es un email de prueba desde <strong>contacto@gopocket.com.mx</strong></p>
        <p>Si recibes este email, la configuración está correcta ✅</p>
      `,
      text: 'Este es un email de prueba desde contacto@gopocket.com.mx',
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: 'Email de prueba enviado' });
  } catch (e) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
```

### Probar desde el navegador o Postman

```bash
# POST a http://localhost:3000/api/test-email
# Body: { "to": "tu-email@gmail.com" }
```

---

## Resumen de Configuración

✅ **Recibir emails:** Cloudflare Email Routing (ya configurado)
✅ **Enviar emails:** Resend (necesitas configurarlo)
✅ **Email desde:** `contacto@gopocket.com.mx`
✅ **Costo:** $0 USD (gratis hasta 3,000 emails/mes)

---

## Variables de Entorno Necesarias

```env
# .env.local
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=contacto@gopocket.com.mx
EMAIL_FROM_NAME=GoPocket
```

**También agrégalas en Vercel:**
- Settings → Environment Variables

---

## Direcciones útiles que puedes crear

- `contacto@gopocket.com.mx` → Para contacto general
- `info@gopocket.com.mx` → Para información
- `ventas@gopocket.com.mx` → Para ventas
- `soporte@gopocket.com.mx` → Para soporte
- `noreply@gopocket.com.mx` → Para emails automáticos (no replies)

Todas se reenviarán a tu email personal vía Cloudflare Email Routing.

¿Quieres que cree el archivo `lib/email/resend.ts` y el endpoint de prueba ahora?
