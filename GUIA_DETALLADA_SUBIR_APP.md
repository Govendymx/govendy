# Guía muy detallada: Cómo subir tu app a la web

Esta guía explica **cada paso** con el mayor detalle posible, como si nunca hubieras subido una app a internet. Sigue los pasos en orden.

---

## Parte 0: ¿Qué vamos a hacer?

1. Subir tu código a **GitHub** (un sitio donde se guarda el código).
2. Conectar ese código con **Vercel** (un servicio que pone tu app en internet).
3. Darle a Vercel unas **claves secretas** (Supabase, Mercado Pago, etc.) para que la app funcione.
4. Configurar **Supabase** y **Mercado Pago** para que usen la nueva dirección web.

Al final tendrás una dirección como `https://pocket-app-abc123.vercel.app` que cualquiera puede abrir en el navegador.

---

## Parte 1: Instalar lo que hace falta

### Paso 1.1 – Instalar Git

1. Ve a: **https://git-scm.com/download/win**
2. Descarga **"Click here to download"** (64-bit).
3. Ejecuta el instalador. Puedes dejar las opciones por defecto. Solo avanza con **Next** hasta **Finish**.
4. Para comprobar que se instaló: abre **PowerShell** (Windows + X → Windows PowerShell) y escribe:
   ```powershell
   git --version
   ```
   Debe salir algo como `git version 2.x.x`. Si sale error, Git no está instalado bien.

### Paso 1.2 – Crear cuenta en GitHub

1. Ve a: **https://github.com**
2. Clic en **Sign up**.
3. Pon tu email, una contraseña y un nombre de usuario.
4. Completa el proceso (verificación de email, etc.).
5. Inicia sesión. Ya tienes cuenta en GitHub.

### Paso 1.3 – Node.js (seguramente ya lo tienes)

Tu proyecto usa Node.js. Si ya te corre `npm run dev` en la carpeta del proyecto, **no hace falta hacer nada**.  
Si no:
- Ve a **https://nodejs.org**
- Descarga la versión **LTS** e instala.

---

## Parte 2: Subir tu proyecto a GitHub

### Paso 2.1 – Abrir la carpeta del proyecto en PowerShell

1. Abre el **Explorador de archivos** y ve a la carpeta donde está tu app (por ejemplo `C:\Users\ALEJANDRO\Documents\Pocket-App`).
2. En la barra de direcciones de la carpeta escribe `powershell` y pulsa **Enter**. Se abrirá PowerShell **ya dentro** de esa carpeta.

### Paso 2.2 – Inicializar Git y hacer el primer “commit”

En PowerShell, escribe **un comando por vez** y pulsa **Enter**:

```powershell
git init
```
**Qué hace:** Prepara la carpeta para usar Git.  
**Qué verás:** Algo como `Initialized empty Git repository in ...`.

```powershell
git add .
```
**Qué hace:** Marca todos los archivos para subirlos.  
**Qué verás:** No suele mostrar nada; es normal.

```powershell
git status
```
**Qué hace:** Muestra qué archivos se van a subir.  
**Qué verás:** Una lista de archivos en verde. Si ves “nothing to commit”, repite `git add .` y luego el siguiente comando.

```powershell
git commit -m "Primer commit para subir a la web"
```
**Qué hace:** Guarda una “foto” de tu proyecto en Git (solo en tu PC por ahora).  
**Qué verás:** Mensaje tipo “X files changed”.  
Si te pide configurar nombre/email:

```powershell
git config --global user.email "tu@email.com"
git config --global user.name "Tu Nombre"
```
(y vuelve a ejecutar el `git commit` de arriba).

### Paso 2.3 – Crear un repositorio nuevo en GitHub

1. Entra en **https://github.com** e inicia sesión.
2. Arriba a la derecha: clic en el **+** → **New repository**.
3. **Repository name:** por ejemplo `pocket-app` (o el nombre que quieras, sin espacios).
4. **Description:** opcional (ej. “Marketplace GoPocket”).
5. Deja **Public**.
6. **No** marques “Add a README” ni “Add .gitignore”. El proyecto ya los tiene.
7. Clic en **Create repository**.

### Paso 2.4 – Conectar tu carpeta con GitHub y subir el código

GitHub te mostrará una página con instrucciones. **No las uses** tal cual; usa estas, cambiando `TU-USUARIO` y `pocket-app` por tu usuario y el nombre del repo que creaste:

En PowerShell (dentro de la carpeta del proyecto):

```powershell
git remote add origin https://github.com/TU-USUARIO/pocket-app.git
```
**Qué hace:** Liga tu carpeta con el repositorio de GitHub.  
**Qué verás:** Nada si va bien. Si dice “remote origin already exists”, puedes saltar este comando.

```powershell
git branch -M main
```
**Qué hace:** Asegura que la rama se llama `main`.

```powershell
git push -u origin main
```
**Qué hace:** Sube tu código a GitHub.  
**Qué verás:** Puede pedirte **usuario y contraseña**.  
- **Usuario:** tu nombre de usuario de GitHub.  
- **Contraseña:** ya **no** es tu contraseña normal. Tienes que usar un **Personal Access Token**:

#### Cómo crear un Token en GitHub (si te lo pide)

1. GitHub → clic en tu **foto** (arriba derecha) → **Settings**.
2. Abajo a la izquierda: **Developer settings**.
3. **Personal access tokens** → **Tokens (classic)**.
4. **Generate new token** → **Generate new token (classic)**.
5. **Note:** “Para Vercel” (o lo que quieras).
6. **Expiration:** 90 days (o No expiration si prefieres).
7. Marca **repo** (acceso a repositorios).
8. **Generate token**.
9. **Copia el token** (solo se muestra una vez).
10. Cuando `git push` pida contraseña, **pega el token** (no tu contraseña de GitHub).

Después del `git push` deberías ver algo como “branch main set up to track…” y “X objects pushed”.  
Abre tu repo en GitHub en el navegador y comprueba que se ven tus archivos.

---

## Parte 3: Obtener las claves (variables de entorno)

Antes de conectar con Vercel, necesitas **copiar** estas claves. Guárdalas en un bloc de notas o Word; las pegarás luego en Vercel.

### Paso 3.1 – Claves de Supabase

1. Entra en **https://app.supabase.com** e inicia sesión.
2. Abre tu **proyecto** (el de GoPocket).
3. Menú izquierdo: **Settings** (icono de engranaje).
4. **API** (dentro de Project Settings).
5. Ahí verás:
   - **Project URL** → copia y guárdala como `NEXT_PUBLIC_SUPABASE_URL`.
   - **Project API keys:**
     - **anon public** → cópiala y guárdala como `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
     - **service_role** → clic en “Reveal” y cópiala. Guárdala como `SUPABASE_SERVICE_ROLE_KEY`.  
       ⚠️ **Importante:** La `service_role` es secreta. No la compartas ni la subas a GitHub.

### Paso 3.2 – Claves de Mercado Pago

1. Entra en **https://www.mercadopago.com.mx/developers**.
2. **Tus integraciones** → tu aplicación (o créala si aún no existe).
3. **Credenciales de producción** (no las de prueba).
4. **Access Token** → cópialo y guárdalo como `MERCADOPAGO_ACCESS_TOKEN`.
5. Para el **webhook** inventa una contraseña (ej. `miClaveWebhook123`). Guárdala como `MERCADOPAGO_WEBHOOK_SECRET`.  
   La usarás más adelante también en la configuración del webhook de Mercado Pago.

### Paso 3.3 – URL de tu app (por ahora provisional)

Cuando despliegues en Vercel, te darán una URL tipo `https://pocket-app-xxxx.vercel.app`.  
De momento puedes dejar un placeholder, por ejemplo:  
`https://pocket-app.vercel.app`  
y la cambiarás después por la URL real que te dé Vercel. Guárdala como `NEXT_PUBLIC_SITE_URL`.

---

## Parte 4: Vercel – Cuenta y proyecto

### Paso 4.1 – Crear cuenta en Vercel

1. Ve a **https://vercel.com**.
2. **Sign Up**.
3. Elige **Continue with GitHub**.
4. Autoriza a Vercel para acceder a tu cuenta de GitHub (Accept / Authorize).

### Paso 4.2 – Importar tu repositorio

1. En la página principal de Vercel, **Add New…** → **Project**.
2. Verás una lista de repositorios de GitHub. Busca **pocket-app** (o el nombre que hayas usado).
3. Si **no aparece**:
   - Clic en **Adjust GitHub App Permissions**.
   - Marca **All repositories** o al menos el que tiene tu app.
   - Vuelve a la pestaña del proyecto y refresca; debería salir el repo.
4. Al lado de tu repo, clic en **Import**.

### Paso 4.3 – Configuración del proyecto (pantalla “Configure Project”)

- **Project Name:** Puedes dejarlo como `pocket-app` o cambiarlo.
- **Framework Preset:** Debe decir **Next.js**. No lo cambies.
- **Root Directory:** Déjalo **vacío** (tu código está en la raíz del repo).
- **Build and Output Settings:**  
  - Build Command: `npm run build`  
  - Output Directory: (vacío)  
  - Install Command: `npm install`  
  Normalmente no hace falta tocar nada.

**No hagas clic en Deploy todavía.** Primero añadimos las variables.

---

## Parte 5: Añadir las variables de entorno en Vercel

En la misma pantalla de **Configure Project**:

1. Busca la sección **Environment Variables**.
2. Hay tres columnas: **Key**, **Value** y entornos (Production, Preview, Development).  
   Añade **una variable por fila**:

| Key | Value | Dónde poner el valor |
|-----|--------|----------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | La URL de Supabase (Project URL) | Pegar |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La anon key de Supabase | Pegar |
| `SUPABASE_SERVICE_ROLE_KEY` | La service_role de Supabase | Pegar |
| `MERCADOPAGO_ACCESS_TOKEN` | El Access Token de producción de MP | Pegar |
| `MERCADOPAGO_WEBHOOK_SECRET` | La contraseña que inventaste para el webhook | Pegar |
| `NEXT_PUBLIC_SITE_URL` | `https://pocket-app.vercel.app` (luego la cambias) | Escribir |

Para cada una:
- En **Key** escribes el nombre exacto (ej. `NEXT_PUBLIC_SUPABASE_URL`).
- En **Value** pegas o escribes el valor.
- Marca **Production** (y si quieres también Preview y Development para las de Supabase).
- Clic en **Add** o **Save**.

Comprueba que las **seis** variables están en la lista antes de seguir.

---

## Parte 6: Primer despliegue en Vercel

1. Clic en **Deploy**.
2. Vercel empezará a **buildear** tu proyecto. Verás logs en pantalla.
3. Espera unos minutos. Puede tardar 2–5 minutos.
4. Si **termina bien**:
   - Verás **Congratulations!** y un enlace tipo `https://pocket-app-xxxx.vercel.app`.
   - **Abre ese enlace.** Es tu app en internet.
5. Si **falla**:
   - Lee el **Build Log** (donde salen los mensajes en rojo).
   - Errores frecuentes:
     - **Falta una variable:** vuelve a **Project → Settings → Environment Variables** y añade la que falta. Luego **Deployments** → los tres puntos del último deploy → **Redeploy**.
     - **Error de TypeScript o ESLint:** prueba en tu PC `npm run build`. Si falla, corrige los errores, haz `git add .`, `git commit -m "fix build"`, `git push`. Vercel desplegará de nuevo solo.

---

## Parte 7: Ajustar la URL real y volver a desplegar

1. **Copia la URL** que te dio Vercel (ej. `https://pocket-app-abc123.vercel.app`).
2. En Vercel: **Tu proyecto** → **Settings** → **Environment Variables**.
3. Busca `NEXT_PUBLIC_SITE_URL` y **edítala**: pon la URL real que copiaste.
4. Guarda.
5. **Deployments** → los tres puntos del último deploy → **Redeploy**.  
   Así la app usará la URL correcta en emails y redirecciones.

---

## Parte 8: Configurar Supabase para tu URL

1. **Supabase** → tu proyecto → **Authentication** → **URL Configuration**.
2. **Site URL:** pega tu URL de Vercel (ej. `https://pocket-app-abc123.vercel.app`).
3. **Redirect URLs:** añade estas (una por línea), cambiando por tu URL real:
   - `https://pocket-app-abc123.vercel.app/**`
   - `https://pocket-app-abc123.vercel.app/login`
   - `https://pocket-app-abc123.vercel.app/register`
   - `https://pocket-app-abc123.vercel.app/forgot-password`
4. **Save**.

Así el login, registro y recuperación de contraseña funcionarán en tu app en línea.

---

## Parte 9: Configurar el webhook de Mercado Pago

1. **Mercado Pago Developers** → tu aplicación → **Webhooks** (o **Notificaciones**).
2. **URL de notificación:**  
   `https://tu-url-real.vercel.app/api/mercadopago/webhook`  
   (sustituye por la URL que te dio Vercel).
3. Si te pide **token de seguridad** o **secret**, usa **exactamente** el mismo valor que pusiste en `MERCADOPAGO_WEBHOOK_SECRET` en Vercel.
4. Eventos: al menos **Pagos**.
5. Guarda.

Con esto, cuando alguien pague, Mercado Pago avisará a tu app en producción.

---

## Parte 10: Comprobar que todo funciona

1. Abre tu URL de Vercel en el navegador.
2. Prueba:
   - Ver la página principal.
   - **Registro** y **Login**.
   - Navegar por la app (explorar, mi panel, etc.).
3. Si tienes **dominio propio** (ej. `tudominio.com`), puedes añadirlo después en **Vercel → Settings → Domains** y seguir las instrucciones que te den.

---

## Resumen rápido de pasos

| # | Qué hacer |
|---|-----------|
| 1 | Instalar Git y crear cuenta en GitHub |
| 2 | En PowerShell, en la carpeta del proyecto: `git init`, `git add .`, `git commit -m "..."` |
| 3 | Crear repo en GitHub (vacío, sin README) |
| 4 | `git remote add origin ...`, `git branch -M main`, `git push -u origin main` |
| 5 | Copiar claves de Supabase y Mercado Pago |
| 6 | Vercel → Sign up with GitHub → Add New → Project → Import repo |
| 7 | Añadir las 6 variables de entorno en Vercel |
| 8 | Deploy → esperar → abrir la URL |
| 9 | Actualizar `NEXT_PUBLIC_SITE_URL` con la URL real y Redeploy |
| 10 | Configurar Supabase (Site URL, Redirect URLs) y webhook de Mercado Pago |

---

## Si algo sale mal

- **“Permission denied” o “Authentication failed” al hacer `git push`:**  
  Usa un **Personal Access Token** de GitHub como contraseña, no tu contraseña normal (ver Paso 2.4).

- **Build falla en Vercel:**  
  Ejecuta `npm run build` en tu PC. Corrige los errores que salgan, haz commit y push. Vercel volverá a desplegar.

- **“Missing env var” o “Unauthorized” en la app:**  
  Revisa que las **seis** variables estén en Vercel y que hayas hecho **Redeploy** después de añadirlas.

- **Login/registro no funciona en la URL de Vercel:**  
  Revisa **Supabase → Authentication → URL Configuration**: Site URL y Redirect URLs deben usar **tu URL de Vercel**.

- **Pagos de Mercado Pago no se confirman:**  
  Revisa que la URL del webhook sea `https://tu-dominio.vercel.app/api/mercadopago/webhook` y que el token/secret coincida con `MERCADOPAGO_WEBHOOK_SECRET`.

Si quieres, puedes decirme en qué paso exacto te atascas (por ejemplo “Paso 2.4” o “Parte 5”) y te lo detallo todavía más.
