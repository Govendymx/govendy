# 🚀 Guía Super Simple: Cómo Subir tu App a Internet

## 📚 ¿Qué vamos a hacer?

Vamos a poner tu aplicación en internet para que cualquier persona pueda acceder a ella desde cualquier lugar del mundo. Es como subir una foto a Instagram, pero en lugar de una foto, subimos tu aplicación completa.

---

## 🎯 PASO 1: Entender qué necesitas

### ¿Qué es GitHub?
GitHub es como un "Google Drive" para programadores. Es donde guardas tu código en internet.

### ¿Qué es Vercel?
Vercel es el lugar donde tu aplicación va a "vivir" en internet. Es gratis y muy fácil de usar.

### ¿Qué son las "variables de entorno"?
Son como contraseñas y configuraciones secretas que tu app necesita para funcionar. Por ejemplo, las claves de Supabase o Mercado Pago.

---

## 📝 PASO 2: Preparar tu código en GitHub

### 2.1 Crear cuenta en GitHub (si no la tienes)

1. Ve a: **https://github.com**
2. Haz clic en **"Sign up"** (Registrarse)
3. Completa el formulario con:
   - Tu nombre de usuario
   - Tu correo electrónico
   - Una contraseña
4. Verifica tu correo electrónico

### 2.2 Instalar Git en tu computadora (si no lo tienes)

1. Ve a: **https://git-scm.com/download/win**
2. Descarga Git para Windows
3. Instálalo (solo haz clic en "Siguiente" en todo)
4. Abre **PowerShell** o **Git Bash** en tu computadora

### 2.3 Subir tu proyecto a GitHub

**Abre PowerShell en la carpeta de tu proyecto:**

1. Abre el Explorador de Archivos
2. Ve a: `C:\Users\ALEJANDRO\Documents\Pocket-App`
3. Haz clic derecho en la carpeta `Pocket-App`
4. Selecciona **"Abrir en terminal"** o **"Git Bash Here"**

**Ahora escribe estos comandos uno por uno (presiona Enter después de cada uno):**

```bash
# Paso 1: Inicializar Git (solo la primera vez)
git init

# Paso 2: Agregar todos tus archivos
git add .

# Paso 3: Guardar los cambios (como un "guardar" en Word)
git commit -m "Mi primera versión de la app"
```

**Ahora crea el repositorio en GitHub:**

1. Ve a **https://github.com** e inicia sesión
2. Haz clic en el botón **"+"** (arriba a la derecha)
3. Selecciona **"New repository"**
4. Ponle un nombre, por ejemplo: `pocket-app`
5. **NO marques** "Add a README file" (ya tienes archivos)
6. Haz clic en **"Create repository"**

**Conecta tu proyecto local con GitHub:**

GitHub te mostrará comandos. Usa estos (reemplaza `TU-USUARIO` con tu nombre de usuario de GitHub):

```bash
# Conectar tu proyecto con GitHub
git remote add origin https://github.com/TU-USUARIO/pocket-app.git

# Cambiar a la rama principal
git branch -M main

# Subir tu código a GitHub
git push -u origin main
```

Te pedirá tu usuario y contraseña de GitHub. Si te pide un "token", ve a la sección de abajo sobre tokens.

**✅ Verificación:** Ve a tu repositorio en GitHub. Deberías ver todos tus archivos ahí.

---

## 🔑 PASO 3: Obtener tus "variables de entorno" (las contraseñas de tu app)

Tu aplicación necesita estas "contraseñas" para funcionar. Vamos a obtenerlas una por una.

### 3.1 Variables de Supabase

1. Ve a: **https://app.supabase.com**
2. Inicia sesión
3. Selecciona tu proyecto
4. Ve a **Settings** (Configuración) → **API**
5. Busca estas dos cosas y **cópialas** en un archivo de texto:

   - **Project URL**: Es algo como `https://xxxxx.supabase.co`
     - Cópiala → Esta será tu variable `NEXT_PUBLIC_SUPABASE_URL`
   
   - **anon public key**: Es una clave larga que empieza con `eyJ...`
     - Cópiala → Esta será tu variable `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   
   - **service_role key**: Haz clic en "Reveal" para verla (es secreta)
     - Cópiala → Esta será tu variable `SUPABASE_SERVICE_ROLE_KEY`

### 3.2 Variables de Mercado Pago

1. Ve a: **https://www.mercadopago.com.mx/developers**
2. Inicia sesión
3. Ve a **Tus integraciones** → Selecciona tu aplicación
4. Ve a **Credenciales de producción**
5. Busca **Access Token** y cópialo
   - Esta será tu variable `MERCADOPAGO_ACCESS_TOKEN`

6. Para el webhook, inventa una contraseña (por ejemplo: `mi-webhook-secreto-123`)
   - Esta será tu variable `MERCADOPAGO_WEBHOOK_SECRET`

### 3.3 URL de tu sitio

Por ahora, usa esta (la cambiarás después):
- `NEXT_PUBLIC_SITE_URL` = `https://tu-proyecto.vercel.app` (la cambiarás cuando Vercel te dé tu URL real)

**📝 IMPORTANTE:** Guarda todas estas variables en un archivo de texto. Las vas a necesitar en el siguiente paso.

---

## 🌐 PASO 4: Crear cuenta en Vercel y conectar tu proyecto

### 4.1 Crear cuenta en Vercel

1. Ve a: **https://vercel.com**
2. Haz clic en **"Sign Up"**
3. Selecciona **"Continue with GitHub"** (es más fácil)
4. Autoriza a Vercel para acceder a tus repositorios de GitHub

### 4.2 Importar tu proyecto

1. En el dashboard de Vercel, haz clic en **"Add New..."**
2. Selecciona **"Project"**
3. Verás una lista de tus repositorios de GitHub
4. Busca `pocket-app` (o el nombre que le pusiste)
5. Haz clic en **"Import"**

### 4.3 Configurar el proyecto (NO hagas clic en Deploy todavía)

Vercel detectará automáticamente que es Next.js. **No cambies nada**, solo verifica:

- **Framework Preset:** Next.js (debería estar seleccionado)
- **Root Directory:** (déjalo vacío)
- **Build Command:** `npm run build` (ya está)
- **Install Command:** `npm install` (ya está)

---

## 🔐 PASO 5: Agregar las variables de entorno en Vercel

**Esto es MUY importante.** Sin estas variables, tu app no funcionará.

1. En la misma pantalla de configuración, busca la sección **"Environment Variables"**
2. Haz clic en **"Add"** o **"Add Variable"** para cada una

**Agrega estas variables UNA POR UNA:**

| Nombre de la Variable | Valor | Marca estas casillas |
|----------------------|-------|---------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | (Pega la URL de Supabase) | ✅ Production, ✅ Preview, ✅ Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (Pega la anon key) | ✅ Production, ✅ Preview, ✅ Development |
| `SUPABASE_SERVICE_ROLE_KEY` | (Pega la service_role key) | ✅ Production, ✅ Preview, ✅ Development |
| `MERCADOPAGO_ACCESS_TOKEN` | (Pega el token de Mercado Pago) | ✅ Production (solo esta) |
| `MERCADOPAGO_WEBHOOK_SECRET` | (La contraseña que inventaste) | ✅ Production (solo esta) |
| `NEXT_PUBLIC_SITE_URL` | `https://tu-proyecto.vercel.app` | ✅ Production (solo esta) |

**Para cada variable:**
1. Escribe el **Nombre** en el primer campo
2. Pega el **Valor** en el segundo campo
3. Marca las casillas según la tabla de arriba
4. Haz clic en **"Save"** o **"Add"**

**✅ Verificación:** Deberías ver 6 variables en la lista antes de continuar.

---

## 🚀 PASO 6: ¡Hacer el primer despliegue!

1. Cuando hayas agregado todas las variables, haz clic en el botón **"Deploy"** (abajo a la derecha)
2. **Espera** (esto puede tardar 2-5 minutos)
3. Verás una barra de progreso que dice "Building..." y luego "Deploying..."

**¿Qué está pasando?**
- Vercel está descargando tu código
- Instalando todas las dependencias (como `npm install`)
- Compilando tu aplicación (como `npm run build`)
- Subiéndola a internet

**Si hay un error:**
- No te preocupes, es normal la primera vez
- Haz clic en el error para ver qué pasó
- Los errores más comunes:
  - **Falta una variable de entorno** → Vuelve al Paso 5 y agrégala
  - **Error de TypeScript** → Revisa el código en tu computadora primero

**Si todo salió bien:**
- Verás un mensaje: **"Congratulations!"**
- Te dará una URL como: `https://pocket-app-xxxxx.vercel.app`
- **¡Esa es la URL de tu app en internet!** 🎉

---

## ⚙️ PASO 7: Configurar todo después del despliegue

### 7.1 Actualizar la URL en Vercel

1. En Vercel, ve a tu proyecto
2. Ve a **Settings** → **Environment Variables**
3. Busca `NEXT_PUBLIC_SITE_URL`
4. Edítala y pon la URL exacta que te dio Vercel (ejemplo: `https://pocket-app-abc123.vercel.app`)
5. Guarda
6. Ve a **Deployments** → Haz clic en los tres puntos del último deploy → **Redeploy**

### 7.2 Configurar Supabase

1. Ve a **https://app.supabase.com** → Tu proyecto → **Authentication** → **URL Configuration**
2. En **Site URL**, pega tu URL de Vercel: `https://tu-proyecto.vercel.app`
3. En **Redirect URLs**, agrega estas líneas (una por una):
   ```
   https://tu-proyecto.vercel.app/**
   https://tu-proyecto.vercel.app/login
   https://tu-proyecto.vercel.app/register
   ```
4. Haz clic en **Save**

### 7.3 Configurar Mercado Pago Webhook

1. Ve a **https://www.mercadopago.com.mx/developers** → Tu aplicación → **Webhooks**
2. En **URL de notificación**, pega:
   ```
   https://tu-proyecto.vercel.app/api/mercadopago/webhook
   ```
3. Si te pide **Token de seguridad**, usa el mismo valor que pusiste en `MERCADOPAGO_WEBHOOK_SECRET`
4. En **Eventos**, marca al menos **Pagos** (`payment`)
5. Guarda

---

## ✅ PASO 8: ¡Probar tu app!

1. Abre tu navegador
2. Ve a la URL que te dio Vercel (ejemplo: `https://pocket-app-abc123.vercel.app`)
3. **¡Tu app debería estar funcionando!** 🎊

**Prueba:**
- Iniciar sesión
- Navegar por la app
- Ver si todo funciona correctamente

---

## 🔄 PASO 9: Actualizar tu app en el futuro

Cada vez que quieras hacer cambios:

1. Haz tus cambios en tu computadora
2. Abre PowerShell en la carpeta del proyecto
3. Escribe estos comandos:

```bash
git add .
git commit -m "Descripción de lo que cambiaste"
git push
```

4. **¡Eso es todo!** Vercel automáticamente detectará los cambios y desplegará una nueva versión (tarda 2-5 minutos)

---

## ❓ Problemas Comunes y Soluciones

### "No puedo hacer push a GitHub"
- **Solución:** Necesitas un "Personal Access Token" de GitHub:
  1. GitHub → Tu foto (arriba derecha) → **Settings**
  2. **Developer settings** → **Personal access tokens** → **Tokens (classic)**
  3. **Generate new token (classic)**
  4. Dale un nombre, marca **repo** (todos los permisos de repositorio)
  5. Genera y **copia el token** (solo lo verás una vez)
  6. Cuando Git te pida contraseña, usa este token en lugar de tu contraseña

### "El build falla en Vercel"
- **Solución:** Prueba en tu computadora primero:
  1. Abre PowerShell en tu proyecto
  2. Escribe: `npm run build`
  3. Si falla ahí, corrige los errores antes de hacer push

### "Mi app no carga imágenes"
- **Solución:** Revisa que las URLs de Cloudinary estén correctas en tu código

### "No puedo iniciar sesión"
- **Solución:** Verifica que configuraste bien las URLs en Supabase (Paso 7.2)

---

## 📞 ¿Necesitas ayuda?

Si algo no funciona:
1. Revisa los logs en Vercel (ve a **Deployments** → Haz clic en el deploy → **View Function Logs**)
2. Revisa que todas las variables de entorno estén correctas
3. Verifica que las URLs en Supabase y Mercado Pago sean correctas

---

## 🎉 ¡Felicidades!

Si llegaste hasta aquí, tu app está en internet. Ahora puedes compartir la URL con quien quieras.

**Recuerda:**
- Cada vez que hagas cambios, haz `git push` y Vercel actualizará automáticamente
- No compartas tus variables de entorno (son secretas)
- Si necesitas ayuda, revisa los logs en Vercel

¡Éxito con tu aplicación! 🚀
