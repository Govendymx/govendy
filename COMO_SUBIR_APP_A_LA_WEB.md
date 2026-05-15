# Cómo subir tu app GoPocket a la web – Paso a paso

Guía para publicar tu marketplace en internet usando **Vercel** (gratis y muy fácil con Next.js).

---

## 1. Antes de empezar

### 1.1 Tener instalado
- **Node.js 18+** (para compilar en tu PC).
- **Git** (para subir el código).
- **Cuenta en GitHub** (o GitLab / Bitbucket).

### 1.2 Tu proyecto en Git
Tu código debe estar en un repositorio (GitHub, etc.). Si aún no:

1. Abre **Git Bash** o **PowerShell** en la carpeta del proyecto (`Pocket-App`).
2. Ejecuta:
   ```bash
   git init
   git add .
   git commit -m "Primer commit para despliegue"
   ```
3. Crea un repositorio en GitHub (por ejemplo `mi-usuario/pocket-app`).
4. Conéctalo y sube:
   ```bash
   git remote add origin https://github.com/tu-usuario/tu-repo.git
   git branch -M main
   git push -u origin main
   ```
   (Sustituye `tu-usuario` y `tu-repo` por los tuyos.)

---

## 2. Lista de variables de entorno

Tu app usa estas variables. **No las subas al repo**; las configurarás en Vercel.

Copia tus valores desde:
- **Supabase:** [app.supabase.com](https://app.supabase.com) → tu proyecto → **Settings** → **API**.
- **Mercado Pago:** [developers.mercadopago.com](https://www.mercadopago.com.mx/developers) → tu app → Credenciales.

| Variable | Dónde se usa | Dónde obtenerla |
|----------|--------------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase (cliente) | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (cliente) | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (servidor, admin) | Supabase → Settings → API → service_role (⚠️ secreta) |
| `MERCADOPAGO_ACCESS_TOKEN` | Pagos | Mercado Pago → Credenciales de producción |
| `MERCADOPAGO_WEBHOOK_SECRET` | Webhook de pagos | Lo creas tú; luego lo pones en MP |
| `NEXT_PUBLIC_SITE_URL` o `SITE_URL` | Links en emails y redirecciones | Tu URL final, ej. `https://tu-app.vercel.app` |

**Opcionales** (notificaciones por correo, etc.):
- `EMAIL_NOTIFICATIONS_ENABLED` = `true`
- `EMAIL_NOTIFICATIONS_MAILBOX_INDEX` = `0`
- Configuración de **Buzón de correo** en Admin → Configuración (usa la que ya tienes).

Guarda estos valores en un archivo de texto o gestor de contraseñas; los vas a pegar en Vercel.

---

## 3. Crear cuenta en Vercel y conectar el repo

### 3.1 Cuenta Vercel
1. Entra en [vercel.com](https://vercel.com) y haz clic en **Sign Up**.
2. Elige **Continue with GitHub** (recomendado).
3. Autoriza a Vercel para acceder a tus repos.

### 3.2 Nuevo proyecto
1. En el dashboard de Vercel, **Add New…** → **Project**.
2. Importa el repositorio donde está tu app (`pocket-app` o el nombre que uses).
3. Si no aparece, **Adjust GitHub App Permissions** y da acceso al repo.

### 3.3 Configurar el proyecto
- **Framework Preset:** Vercel detecta **Next.js**; no lo cambies.
- **Root Directory:** Déjalo vacío si el proyecto está en la raíz del repo.
- **Build Command:** `npm run build` (por defecto).
- **Output Directory:** (vacío, Next.js lo gestiona).
- **Install Command:** `npm install`.

No hagas clic en **Deploy** todavía; primero añade las variables.

---

## 4. Añadir variables de entorno en Vercel

1. En la misma pantalla de **Create Project**, abre **Environment Variables**.
2. Añade **una por una**:

   | Name | Value | Entorno |
   |------|--------|---------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (anon key) | Production, Preview, Development |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role) | Production, Preview, Development |
   | `MERCADOPAGO_ACCESS_TOKEN` | Tu token de producción | Production |
   | `MERCADOPAGO_WEBHOOK_SECRET` | Una contraseña que inventes (ej. `mi-webhook-secreto-123`) | Production |
   | `NEXT_PUBLIC_SITE_URL` | `https://tu-proyecto.vercel.app` | Production |

   Puedes dejar **Preview** y **Development** sin `MERCADOPAGO_*` si no vas a probar pagos ahí.

3. Guarda cada variable (**Add** / **Save**).

---

## 5. Primer despliegue

1. Haz clic en **Deploy**.
2. Espera a que termine el **Build** (unos minutos).
3. Si hay error:
   - Revisa el **Build Log** en Vercel.
   - Errores típicos: variable faltante, `npm run build` falla (lint/TypeScript). Corrígelos en tu repo, haz commit y push; Vercel volverá a desplegar.

4. Cuando termine, verás algo como:
   - **Congratulations!** y un enlace: `https://tu-proyecto.vercel.app`.

Esa URL es ya tu app en la web.

---

## 6. Configuración tras el primer despliegue

### 6.1 Actualizar `NEXT_PUBLIC_SITE_URL`
1. En Vercel: **Project** → **Settings** → **Environment Variables**.
2. Edita `NEXT_PUBLIC_SITE_URL` y pon exactamente la URL que te dio Vercel (ej. `https://pocket-app-xxx.vercel.app`).
3. **Redeploy:** **Deployments** → los tres puntos del último deploy → **Redeploy**.

### 6.2 Supabase: URLs de redirección
1. Supabase → **Authentication** → **URL Configuration**.
2. En **Site URL** pon tu URL de Vercel (ej. `https://tu-proyecto.vercel.app`).
3. En **Redirect URLs** añade:
   - `https://tu-proyecto.vercel.app/**`
   - `https://tu-proyecto.vercel.app/login`
   - `https://tu-proyecto.vercel.app/register`
   - Las que uses para recuperación de contraseña, etc.
4. Guarda.

### 6.3 Mercado Pago: Webhook
1. [Mercado Pago Developers](https://www.mercadopago.com.mx/developers) → tu aplicación → **Webhooks**.
2. **URL de notificación:**  
   `https://tu-proyecto.vercel.app/api/mercadopago/webhook`
3. Si usas **token de seguridad** (recomendado), ese valor debe ser **el mismo** que `MERCADOPAGO_WEBHOOK_SECRET` en Vercel.
4. Eventos: al menos **Pagos** (`payment`).
5. Guarda.

### 6.4 Cloudinary (si usas imágenes)
Si tu app usa Cloudinary, en **Cloudinary** → **Settings** → **Security** puedes añadir tu dominio de Vercel en **Allowed fetch domains** para evitar bloqueos. No es obligatorio para un primer despliegue.

---

## 7. Dominio propio (opcional)

### 7.1 En Vercel
1. **Project** → **Settings** → **Domains**.
2. Añade tu dominio (ej. `gopocket.com.mx`).
3. Sigue las instrucciones para añadir los registros **CNAME** o **A** en tu proveedor de dominios (GoDaddy, Namecheap, etc.).
4. Cuando esté verificado, Vercel usará ese dominio para tu app.

### 7.2 Actualizar variables y servicios
- Cambia `NEXT_PUBLIC_SITE_URL` (y `SITE_URL` si la usas) a `https://tudominio.com`.
- En **Supabase** y **Mercado Pago** actualiza Site URL, Redirect URLs y URL del webhook a `https://tudominio.com/...`.
- Haz **Redeploy** en Vercel tras cambiar variables.

---

## 8. Resumen de pasos

| Paso | Acción |
|------|--------|
| 1 | Proyecto en Git (GitHub, etc.) |
| 2 | Tener a mano todas las variables de entorno |
| 3 | Cuenta Vercel y **Import** del repo |
| 4 | Añadir **Environment Variables** en Vercel |
| 5 | **Deploy** y esperar el build |
| 6 | Configurar **Supabase** (URLs, redirects) y **Mercado Pago** (webhook) |
| 7 | (Opcional) Dominio propio en **Domains** |

---

## 9. Próximos despliegues

Cada vez que hagas **push** a la rama conectada (por ejemplo `main`):

```bash
git add .
git commit -m "Descripción de cambios"
git push
```

Vercel desplegará automáticamente una nueva versión. No hace falta repetir la configuración de variables ni del dominio.

---

## 10. Problemas frecuentes

### “Missing Authorization Bearer token” / “Unauthorized”
- Revisa que **todas** las variables de entorno estén en Vercel y que hayas hecho **Redeploy** después de añadirlas.

### “SUPABASE_SERVICE_ROLE_KEY es igual a ANON_KEY”
- Usa la clave **service_role** de Supabase, no la **anon**. Está en **Settings** → **API** → **service_role** (oculta; haz clic en “Reveal”).

### Webhook de Mercado Pago no recibe pagos
- URL debe ser `https://tu-dominio.com/api/mercadopago/webhook` (con `https`).
- Si usas token, debe coincidir con `MERCADOPAGO_WEBHOOK_SECRET`.
- Prueba con un pago de prueba y revisa los logs en Mercado Pago.

### Build falla en Vercel
- Revisa el **Build Log**.
- Prueba en tu PC: `npm run build`. Si falla ahí, corrige errores de TypeScript o ESLint antes de hacer push.

### Las imágenes no cargan
- Revisa **Cloudinary** y que las URLs de imágenes en tu app usen el dominio correcto.
- Si usas Supabase Storage, comprueba políticas RLS y URLs públicas.

---

Si sigues estos pasos, tu app quedará en la web y podrás compartir el enlace. Para más detalle técnico (BD, Estafeta, etc.), usa tu **CHECKLIST_DESPLIEGUE.md**.
