# 🌐 Guía de Despliegue en Netlify

## Paso 1: Conectar GitHub

1. **En la pantalla actual:**
   - Haz clic en el botón **"GitHub"** (con el logo del octocat)

2. **Autorizar Netlify:**
   - GitHub te pedirá autorizar Netlify
   - Selecciona qué repositorios dar acceso:
     - **Recomendado**: "Solo seleccionar repositorios" → Elige `Pocket-App`
   - Haz clic en **"Instalar"** o **"Authorize"**

3. **Seleccionar repositorio:**
   - Netlify mostrará tus repositorios
   - Busca y selecciona `Pocket-App` (o el nombre de tu repo)

## Paso 2: Configurar el Build

Netlify detectará automáticamente Next.js, pero verifica:

1. **Build settings:**
   - **Build command**: `npm run build` (o `yarn build`)
   - **Publish directory**: `.next` (pero Next.js en Netlify usa configuración especial)
   - **Framework preset**: Next.js (debería detectarlo automáticamente)

2. **⚠️ IMPORTANTE para Next.js:**
   - Netlify tiene un plugin especial para Next.js
   - Si no lo detecta, agrega `@netlify/plugin-nextjs` en `netlify.toml`

## Paso 3: Configurar Variables de Entorno

1. **Antes de desplegar:**
   - En la pantalla de configuración, busca **"Environment variables"**
   - O después del despliegue: **Site settings** → **Environment variables**

2. **Agrega todas tus variables:**
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

## Paso 4: Crear `netlify.toml` (Recomendado)

Crea este archivo en la raíz de tu proyecto:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "18"
```

## Paso 5: Desplegar

1. **Haz clic en "Deploy site"**
2. **Netlify comenzará a construir:**
   - Puedes ver el progreso en tiempo real
   - Te dará una URL temporal (ej: `go-pocket-123.netlify.app`)

## ⚠️ Consideraciones para Next.js

### API Routes
- Netlify convierte las API routes en funciones serverless
- Funciona bien, pero puede tener límites en el plan gratuito

### SSR (Server-Side Rendering)
- Netlify soporta SSR de Next.js
- Usa el plugin `@netlify/plugin-nextjs` para mejor compatibilidad

### Límites del Plan Gratuito
- **100 GB bandwidth/mes**
- **300 minutos de build/mes**
- **100 horas de funciones serverless/mes**
- **Sin límite de tiempo** (a diferencia de Railway trial)

## 📊 Comparación: Netlify vs Railway

| Característica | Netlify | Railway |
|----------------|---------|---------|
| Plan Gratuito | ✅ Permanente | ⏱️ Trial (30 días) |
| Bandwidth Gratis | 100 GB/mes | Incluido en crédito |
| Build Time | 300 min/mes | Incluido en crédito |
| SSR Next.js | ✅ (con plugin) | ✅ Nativo |
| API Routes | ✅ (serverless) | ✅ Nativo |
| Costo Escalado | 💰💰💰 | 💰💰 |
| Facilidad | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

## 🎯 Recomendación Final

### Usa Netlify si:
- ✅ Quieres un plan gratuito permanente
- ✅ Tu aplicación es principalmente frontend
- ✅ No tienes muchas API routes complejas
- ✅ Prefieres límites claros y predecibles

### Usa Railway si:
- ✅ Necesitas más flexibilidad
- ✅ Tienes muchas API routes
- ✅ Prefieres créditos en lugar de límites fijos
- ✅ $5/mes no es problema

## 🔧 Troubleshooting

### Error: "Build failed"
- Verifica que todas las variables de entorno estén configuradas
- Revisa los logs en **Deploy log**
- Asegúrate de tener `netlify.toml` configurado

### API Routes no funcionan
- Instala el plugin: `npm install @netlify/plugin-nextjs`
- Verifica que `netlify.toml` tenga el plugin configurado

### Límite de funciones serverless
- El plan gratuito tiene 100 horas/mes
- Si excedes, considera el plan Pro ($19/mes)

---

**¿Necesitas ayuda con algún paso específico?** 🚀
