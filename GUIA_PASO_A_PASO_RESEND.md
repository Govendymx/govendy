# 📧 Guía Paso a Paso: Configurar Resend para contacto@gopocket.com.mx

## ✅ Lo que ya está listo en tu app:
- ✅ Código para enviar emails (`lib/email/resend.ts`)
- ✅ Endpoint de prueba (`app/api/test-email/route.ts`)
- ✅ Integración con tu sistema existente

## 🎯 Lo que necesitas hacer (5 pasos simples):

---

## PASO 1: Crear cuenta en Resend (2 minutos)

1. **Abre tu navegador** y ve a: **https://resend.com**
2. Haz clic en **"Sign Up"** (arriba a la derecha)
3. **Regístrate** con tu email: `arturoalejandro031187@gmail.com`
4. **Verifica tu email** (revisa tu bandeja de entrada)
5. **Inicia sesión** en Resend

✅ **Cuando veas el dashboard de Resend, continúa al Paso 2**

---

## PASO 2: Agregar tu dominio (3 minutos)

1. En el menú lateral izquierdo, haz clic en **"Domains"**
2. Haz clic en el botón azul **"Add Domain"** (arriba a la derecha)
3. En el campo que aparece, escribe: **`gopocket.com.mx`**
4. Haz clic en **"Add"** o **"Continue"**

### Lo que verás:
Resend te mostrará **registros DNS** que necesitas agregar en Cloudflare. Ejemplo:

```
Tipo: TXT
Nombre: @
Valor: resend-domain-verification=abc123xyz...

Tipo: CNAME
Nombre: resend._domainkey
Valor: resend._domainkey.resend.com
```

**⚠️ NO CIERRES ESTA PANTALLA** - Necesitarás copiar estos valores.

✅ **Cuando veas los registros DNS, continúa al Paso 3**

---

## PASO 3: Agregar registros DNS en Cloudflare (5 minutos)

1. **Abre otra pestaña** y ve a: **https://dash.cloudflare.com**
2. Selecciona tu dominio: **`gopocket.com.mx`**
3. En el menú lateral, haz clic en **"DNS"** → **"Records"**
4. Haz clic en el botón **"Add record"**

### Para cada registro que Resend te dio:

#### Registro 1 (TXT):
- **Tipo:** `TXT`
- **Nombre:** `@` (o deja vacío si Cloudflare no lo acepta, o pon `gopocket.com.mx`)
- **Contenido:** Copia el valor completo que Resend te dio (ej: `resend-domain-verification=abc123...`)
- **Proxy:** Desactivado (nube gris ☁️)
- Haz clic en **"Save"**

#### Registro 2 (CNAME - si Resend lo requiere):
- **Tipo:** `CNAME`
- **Nombre:** `resend._domainkey` (o lo que Resend te indique)
- **Destino:** `resend._domainkey.resend.com` (o el valor que Resend te dé)
- **Proxy:** Desactivado (nube gris ☁️)
- Haz clic en **"Save"**

### Esperar verificación:
- Vuelve a Resend (pestaña anterior)
- Resend verificará automáticamente (puede tardar **5-30 minutos**)
- El estado cambiará de "Pending" a "Verified" ✅

✅ **Cuando veas "Verified" en Resend, continúa al Paso 4**

---

## PASO 4: Obtener tu API Key (1 minuto)

1. En Resend, en el menú lateral, haz clic en **"API Keys"**
2. Haz clic en el botón **"Create API Key"**
3. **Dale un nombre** (ej: "GoPocket App")
4. Haz clic en **"Add"** o **"Create"**
5. **⚠️ IMPORTANTE:** Copia la clave que aparece (empieza con `re_`)
   - Ejemplo: `re_abc123xyz456...`
   - **Solo se muestra UNA VEZ** - guárdala bien

✅ **Cuando tengas tu API Key copiada, continúa al Paso 5**

---

## PASO 5: Configurar en tu app (2 minutos)

### 5.1 Agregar en `.env.local`

1. Abre el archivo `.env.local` en tu proyecto
2. Agrega estas líneas al final:

```env
# Email con Resend
RESEND_API_KEY=re_pega_aqui_tu_clave
EMAIL_FROM=contacto@gopocket.com.mx
EMAIL_FROM_NAME=GoPocket
```

3. **Reemplaza** `re_pega_aqui_tu_clave` con la clave que copiaste en el Paso 4
4. **Guarda** el archivo

### 5.2 Agregar en Vercel

1. Ve a: **https://vercel.com**
2. Selecciona tu proyecto **Pocket-App**
3. Ve a **"Settings"** (Configuración)
4. En el menú lateral, haz clic en **"Environment Variables"**
5. Haz clic en **"Add New"** y agrega cada una:

   **Variable 1:**
   - **Name:** `RESEND_API_KEY`
   - **Value:** `re_tu_clave_aqui` (la misma que pusiste en .env.local)
   - **Environment:** Marca todas (Production, Preview, Development)
   - Haz clic en **"Save"**

   **Variable 2:**
   - **Name:** `EMAIL_FROM`
   - **Value:** `contacto@gopocket.com.mx`
   - **Environment:** Marca todas
   - Haz clic en **"Save"**

   **Variable 3:**
   - **Name:** `EMAIL_FROM_NAME`
   - **Value:** `GoPocket`
   - **Environment:** Marca todas
   - Haz clic en **"Save"**

6. **Importante:** Después de agregar las variables, ve a **"Deployments"** y haz un nuevo deploy para que se apliquen.

✅ **¡Listo! Ahora prueba que funciona**

---

## 🧪 PASO 6: Probar que funciona

### Opción A: Desde tu app local

1. **Reinicia tu servidor de desarrollo:**
   ```bash
   # Detén el servidor (Ctrl+C) y vuelve a iniciarlo:
   npm run dev
   ```

2. **Prueba el endpoint:**
   - Abre Postman, o usa curl, o crea un botón de prueba en tu app
   - **POST** a: `http://localhost:3000/api/test-email`
   - **Body (JSON):**
     ```json
     {
       "to": "arturoalejandro031187@gmail.com"
     }
     ```

3. **Revisa tu email** - Deberías recibir un email de prueba desde `contacto@gopocket.com.mx`

### Opción B: Desde la consola del navegador

1. Abre tu app en el navegador
2. Abre la consola (F12)
3. Ejecuta:
   ```javascript
   fetch('/api/test-email', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ to: 'arturoalejandro031187@gmail.com' })
   })
   .then(r => r.json())
   .then(console.log)
   ```

---

## ✅ Checklist Final

- [ ] Cuenta creada en Resend
- [ ] Dominio `gopocket.com.mx` agregado en Resend
- [ ] Registros DNS agregados en Cloudflare
- [ ] Dominio verificado en Resend (estado "Verified")
- [ ] API Key obtenida de Resend
- [ ] Variables agregadas en `.env.local`
- [ ] Variables agregadas en Vercel
- [ ] Servidor reiniciado (si pruebas localmente)
- [ ] Email de prueba recibido ✅

---

## 🆘 Si algo no funciona

### El dominio no se verifica en Resend:
- Espera hasta 30 minutos
- Verifica que los registros DNS estén correctos en Cloudflare
- Asegúrate de que el "Proxy" esté desactivado (nube gris)

### No recibes el email de prueba:
- Revisa la consola del servidor (debería mostrar errores)
- Verifica que `RESEND_API_KEY` esté correcta en `.env.local`
- Verifica que el dominio esté "Verified" en Resend
- Revisa la carpeta de spam

### Error "RESEND_API_KEY no configurado":
- Verifica que agregaste la variable en `.env.local`
- Reinicia el servidor (`npm run dev`)
- Verifica que no haya espacios extra en la clave

---

## 📞 ¿Necesitas ayuda?

Si te quedas atascado en algún paso, dime en qué paso estás y qué error ves, y te ayudo.
