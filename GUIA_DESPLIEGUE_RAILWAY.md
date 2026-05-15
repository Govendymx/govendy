# 🚂 Guía de Despliegue en Railway

## Paso 1: Configurar GitHub App en Railway

1. **En la pantalla actual de Railway:**
   - Haz clic en **"Configurar la aplicación GitHub"** (el botón que aparece en el modal)
   - Esto te llevará a GitHub para autorizar Railway

2. **En GitHub:**
   - Selecciona qué repositorios quieres dar acceso a Railway:
     - **Opción recomendada**: "Solo seleccionar repositorios" → Elige tu repositorio `Pocket-App`
     - O "Todos los repositorios" si prefieres
   - Haz clic en **"Instalar"** o **"Authorize"**

3. **Vuelve a Railway:**
   - Refresca la página o vuelve a `/new/github`
   - Ahora deberías ver tu repositorio `Pocket-App` en la lista

## Paso 2: Crear el Proyecto

1. **Selecciona tu repositorio:**
   - Haz clic en `Pocket-App` (o el nombre de tu repo)

2. **Railway detectará automáticamente:**
   - Framework: Next.js
   - Build Command: `npm run build` (o `yarn build`)
   - Start Command: `npm start` (o `yarn start`)

3. **Configuración inicial:**
   - Railway creará el proyecto automáticamente
   - Te dará una URL temporal (ej: `tu-app.up.railway.app`)

## Paso 3: Configurar Variables de Entorno

1. **En el dashboard de Railway:**
   - Ve a tu proyecto → **Variables** (o **Environment Variables**)

2. **Agrega todas tus variables de entorno:**
   ```
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   SUPABASE_URL=tu_url_de_supabase
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=tu_cloud_name
   CLOUDINARY_API_KEY=tu_api_key
   CLOUDINARY_API_SECRET=tu_api_secret
   MERCADOPAGO_ACCESS_TOKEN=tu_access_token
   MERCADOPAGO_PUBLIC_KEY=tu_public_key
   ```

3. **Variables adicionales (si las usas):**
   - Cualquier otra variable que tengas en tu `.env.local`

## Paso 4: Configurar el Dominio (Opcional)

1. **En Railway:**
   - Ve a **Settings** → **Domains**
   - Agrega tu dominio personalizado (ej: `gopocket.com`)
   - Configura los DNS según las instrucciones

## Paso 5: Verificar el Despliegue

1. **Railway desplegará automáticamente:**
   - Cada push a `main` o `master` desplegará automáticamente
   - Puedes ver el progreso en la pestaña **Deployments**

2. **Revisa los logs:**
   - Si hay errores, ve a **Deployments** → **View Logs**
   - Los errores comunes suelen ser variables de entorno faltantes

## ⚠️ Notas Importantes

### Build Settings (si necesitas ajustarlos)

Si Railway no detecta correctamente Next.js, puedes configurarlo manualmente:

1. Ve a **Settings** → **Build & Deploy**
2. **Build Command**: `npm run build`
3. **Start Command**: `npm start`
4. **Root Directory**: `/` (o deja vacío)

### Node.js Version

Railway detecta automáticamente la versión desde tu `package.json`, pero puedes especificarla:

- Crea o edita `.nvmrc` en la raíz:
  ```
  18
  ```
  (o la versión que uses)

### Límites del Plan Gratuito

- **$5 de crédito gratis** al mes
- Se renueva mensualmente
- Si excedes, se pausa el servicio (no se cobra automáticamente)

## 🔧 Troubleshooting

### Error: "No se encontraron repositorios"
- Asegúrate de haber autorizado Railway en GitHub
- Verifica que el repositorio sea público o que hayas dado acceso

### Error en el build
- Revisa los logs en Railway
- Verifica que todas las variables de entorno estén configuradas
- Asegúrate de que `package.json` tenga el script `build`

### La app no carga
- Verifica que el puerto esté configurado correctamente (Next.js usa 3000 por defecto)
- Railway asigna el puerto automáticamente, pero verifica los logs

## 📊 Comparación de Costos

### Railway (Plan Gratuito)
- $5 de crédito/mes gratis
- ~500 horas de ejecución (depende del uso de recursos)
- Se pausa si excedes (no cobra)

### Vercel (Plan Gratuito)
- 100 GB bandwidth/mes
- Límites estrictos en funciones serverless
- Puede ser costoso al escalar

**Railway es más económico para aplicaciones con mucho tráfico o uso intensivo de recursos.**

---

**¿Necesitas ayuda con algún paso específico?** 🚀
