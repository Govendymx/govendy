# 🔧 Solución: Error en @netlify/plugin-nextjs

## Problema
El despliegue falla con el error: "Deploy failed due to an error in @netlify/plugin-nextjs plugin"

## Solución Aplicada

### 1. Actualizar el Plugin
- **Versión anterior**: `@netlify/plugin-nextjs@^4.39.0`
- **Versión nueva**: `@netlify/plugin-nextjs@^5.15.5`
- **Razón**: La versión 5.x tiene mejor soporte para Next.js 15

### 2. Actualizar Node.js
- **Versión anterior**: Node 18
- **Versión nueva**: Node 20
- **Razón**: Next.js 15 requiere Node.js 18.17 o superior, y Node 20 es más estable

## Pasos para Resolver

### Paso 1: Instalar la nueva versión
```bash
npm install @netlify/plugin-nextjs@^5.15.5
```
**⚠️ IMPORTANTE**: El plugin debe estar en `dependencies`, NO en `devDependencies`, porque Netlify lo necesita durante el build.

### Paso 2: Hacer commit y push
```bash
git add package.json netlify.toml
git commit -m "Actualizar plugin de Netlify para Next.js 15"
git push
```

### Paso 3: En Netlify
1. Ve a **Deploy settings** → **Clear cache and retry deploy**
2. O simplemente haz clic en **"Retry"** en el deploy fallido

## Alternativa: Sin Plugin (Si sigue fallando)

Si el plugin sigue dando problemas, puedes intentar sin él:

### Opción 1: Usar el Runtime Legacy
En Netlify, ve a **Site settings** → **Build & deploy** → **Environment variables**:
- Agrega: `NETLIFY_NEXT_PLUGIN_SKIP=true`

### Opción 2: Configuración Manual
Actualiza `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"
  NETLIFY_NEXT_PLUGIN_SKIP = "false"
```

## Verificar Logs

Si el error persiste:
1. Ve a **Deploy log** en Netlify
2. Busca el error específico
3. Los errores comunes son:
   - Variables de entorno faltantes
   - Dependencias no instaladas
   - Errores de compilación de TypeScript

## Recomendación

**Para Next.js 15 + Netlify:**
- ✅ Usa `@netlify/plugin-nextjs@^5.15.5` (versión más reciente)
- ✅ Node.js 20
- ✅ Asegúrate de que todas las variables de entorno estén configuradas

Si después de estos cambios sigue fallando, considera usar **Railway** que tiene mejor soporte nativo para Next.js 15.

## Error de Sintaxis JSX

Si ves errores como "Unexpected token `div`. Expected jsx identifier":

1. **Verifica la versión de Next.js**: El log debe mostrar "Next.js 15.x.x", no "14.x.x"
2. **Limpia el caché en Netlify**: Usa "Clear cache and retry deploy"
3. **Fuerza la instalación limpia**: Cambia `next` de `^15.1.0` a `15.1.0` (sin `^`) para evitar versiones incorrectas
4. **Verifica que `npm ci` se ejecute**: Esto asegura una instalación limpia basada en `package-lock.json`
