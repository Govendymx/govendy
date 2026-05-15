# 🔄 Actualizar Configuración Después de Cambiar Dominio

Después de mover tu dominio a otro proyecto de Vercel, necesitas actualizar estas configuraciones:

---

## ✅ 1. SUPABASE (OBLIGATORIO)

### Paso 1: Actualizar URLs en Supabase

1. Ve a **https://app.supabase.com**
2. Selecciona tu proyecto
3. Ve a **Settings → Authentication → URL Configuration**

### Paso 2: Actualizar Site URL

En el campo **"Site URL"**, cambia a:
```
https://www.gopocket.com.mx
```
o
```
https://gopocket.com.mx
```
(depende de cuál sea tu dominio principal)

### Paso 3: Actualizar Redirect URLs

En **"Redirect URLs"**, agrega o actualiza todas estas URLs:

```
https://www.gopocket.com.mx/**
https://www.gopocket.com.mx/login
https://www.gopocket.com.mx/register
https://www.gopocket.com.mx/reset-password
https://www.gopocket.com.mx/forgot-password
https://gopocket.com.mx/**
https://gopocket.com.mx/login
https://gopocket.com.mx/register
```

**💡 Tip**: Si tienes ambos dominios (con y sin www), agrega ambos.

### Paso 4: Guardar

Haz clic en **"Save"** al final de la página.

---

## ✅ 2. VERCEL - Variables de Entorno (OBLIGATORIO)

### Paso 1: Ir a Variables de Entorno

1. En Vercel, ve a tu **nuevo proyecto**
2. Ve a **Settings → Environment Variables**

### Paso 2: Actualizar NEXT_PUBLIC_SITE_URL

Busca la variable `NEXT_PUBLIC_SITE_URL` y actualízala a:

```
https://www.gopocket.com.mx
```

o

```
https://gopocket.com.mx
```

### Paso 3: Verificar Otras Variables

Asegúrate de que estas variables estén configuradas correctamente:

- ✅ `NEXT_PUBLIC_SUPABASE_URL` (debe estar igual)
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (debe estar igual)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (debe estar igual)
- ✅ `RESEND_API_KEY` (si usas Resend)
- ✅ `EMAIL_FROM` (debe ser `contacto@gopocket.com.mx` o similar)
- ✅ `EMAIL_FROM_NAME` (debe ser `GoPocket`)

### Paso 4: Guardar y Redeploy

1. **Guarda** los cambios
2. Ve a **Deployments**
3. Haz clic en los **tres puntos (⋯)** del último deployment
4. Selecciona **"Redeploy"**
5. Confirma el redeploy

---

## ✅ 3. RESEND (Si usas Resend para correos)

### Paso 1: Verificar Dominio en Resend

1. Ve a **https://resend.com**
2. Inicia sesión
3. Ve a **"Domains"**
4. Verifica que `gopocket.com.mx` esté listado y con estado **"Verified"**

### Paso 2: Si el Dominio NO está Verificado

Si Resend no reconoce tu dominio o no está verificado:

1. En Resend, haz clic en **"Add Domain"**
2. Escribe `gopocket.com.mx`
3. Resend te dará registros DNS para agregar
4. Ve a tu proveedor de DNS (Cloudflare, GoDaddy, etc.)
5. Agrega los registros que Resend te proporciona
6. Espera 5-30 minutos a que Resend verifique el dominio

### Paso 3: Verificar Variables en Vercel

En Vercel → Settings → Environment Variables, verifica:

```
RESEND_API_KEY=re_tu_clave_aqui
EMAIL_FROM=contacto@gopocket.com.mx
EMAIL_FROM_NAME=GoPocket
```

**⚠️ IMPORTANTE**: Si cambiaste el dominio, asegúrate de que `EMAIL_FROM` use el dominio correcto.

---

## ✅ 4. MERCADOPAGO (Si usas pagos)

### Paso 1: Actualizar Webhook

1. Ve a **https://www.mercadopago.com.mx/developers**
2. Selecciona tu aplicación
3. Ve a **"Webhooks"** o **"Notificaciones"**

### Paso 2: Actualizar URL del Webhook

Actualiza la **URL de notificación** a:

```
https://www.gopocket.com.mx/api/mercadopago/webhook
```

o

```
https://gopocket.com.mx/api/mercadopago/webhook
```

### Paso 3: Verificar Secret

Asegúrate de que `MERCADOPAGO_WEBHOOK_SECRET` en Vercel sea el mismo que configuraste en MercadoPago.

### Paso 4: Guardar

Guarda los cambios en MercadoPago.

---

## ✅ 5. CLOUDINARY (Si usas imágenes)

### Paso 1: Actualizar Dominios Permitidos

1. Ve a **https://cloudinary.com**
2. Inicia sesión
3. Ve a **Settings → Security**

### Paso 2: Actualizar Allowed Fetch Domains

En **"Allowed fetch domains"**, agrega o actualiza:

```
www.gopocket.com.mx
gopocket.com.mx
```

### Paso 3: Guardar

Guarda los cambios.

---

## ✅ 6. BUZONES DE CORREO (Si usas buzones SMTP configurados en Admin)

Si tienes buzones de correo configurados en el panel de administración:

### Paso 1: Verificar Configuración

1. Ve a tu aplicación: `https://www.gopocket.com.mx/admin/settings`
2. Inicia sesión como administrador
3. Ve a la sección **"Buzón de correo"**

### Paso 2: Verificar que las Configuraciones Estén Correctas

Los buzones SMTP deberían seguir funcionando igual, pero verifica que:
- Las direcciones de correo sigan siendo válidas
- Los servidores SMTP sigan siendo los correctos
- Las credenciales estén correctas

**💡 Nota**: Si usas direcciones como `contacto@gopocket.com.mx`, estas deberían seguir funcionando igual siempre que el dominio esté configurado correctamente en tu proveedor de correo.

---

## ✅ 7. VERIFICACIÓN FINAL

Después de actualizar todo, verifica:

### 1. Dominio Funciona
- [ ] Abre `https://www.gopocket.com.mx` en tu navegador
- [ ] La aplicación carga correctamente

### 2. Autenticación Funciona
- [ ] Puedes iniciar sesión con email/password
- [ ] OAuth (Google/Facebook) funciona correctamente
- [ ] Puedes registrarte

### 3. Correos Funcionan
- [ ] Prueba enviar un correo desde tu app
- [ ] Verifica que llegue correctamente
- [ ] Verifica que el remitente sea correcto (ej: `contacto@gopocket.com.mx`)

### 4. Webhooks Funcionan (si aplica)
- [ ] Prueba un pago de prueba en MercadoPago
- [ ] Verifica que el webhook llegue correctamente

---

## 📝 Checklist Completo

Antes de considerar todo listo:

- [ ] URLs actualizadas en Supabase (Site URL y Redirect URLs)
- [ ] `NEXT_PUBLIC_SITE_URL` actualizada en Vercel
- [ ] Todas las variables de entorno verificadas en Vercel
- [ ] Redeploy realizado en Vercel
- [ ] Dominio verificado en Resend (si usas Resend)
- [ ] Webhook de MercadoPago actualizado (si usas pagos)
- [ ] Dominios permitidos actualizados en Cloudinary (si usas imágenes)
- [ ] Dominio funciona correctamente
- [ ] Autenticación funciona
- [ ] Correos funcionan
- [ ] Webhooks funcionan (si aplica)

---

## 🐛 Problemas Comunes

### OAuth no funciona después del cambio

**Solución**:
1. Verifica que las URLs en Supabase estén actualizadas
2. Verifica que `NEXT_PUBLIC_SITE_URL` esté correcta en Vercel
3. Haz un redeploy
4. Limpia las cookies del navegador y prueba de nuevo

### Correos no se envían

**Solución**:
1. Verifica que `RESEND_API_KEY` esté configurada en Vercel
2. Verifica que el dominio esté verificado en Resend
3. Verifica que `EMAIL_FROM` use el dominio correcto
4. Revisa los logs en Vercel para ver errores específicos

### Webhooks de MercadoPago no funcionan

**Solución**:
1. Verifica que la URL del webhook esté actualizada en MercadoPago
2. Verifica que `MERCADOPAGO_WEBHOOK_SECRET` sea el mismo en Vercel y MercadoPago
3. Prueba manualmente el endpoint: `https://www.gopocket.com.mx/api/mercadopago/webhook`

---

¿Necesitas ayuda con algún paso específico? ¡Avísame!
