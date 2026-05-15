# 🚀 Cómo Actualizar Next.js

## Versión Actual
- **Tu versión**: Next.js 15.1.0
- **Última versión estable**: Next.js 16.1.4 (Enero 2026)
- **Última versión de Next.js 15**: 15.2.x

## ⚠️ Consideraciones Importantes

### Opción 1: Actualizar a Next.js 16 (Última versión)
- ✅ Incluye nuevas características (Cache Components, Turbopack estable)
- ⚠️ **Breaking changes**: Puede requerir cambios en tu código
- ⚠️ **Compatibilidad**: Verifica que todas tus dependencias sean compatibles

### Opción 2: Actualizar a Next.js 15.2.x (Recomendado)
- ✅ Más seguro, menos breaking changes
- ✅ Mantiene compatibilidad con tu código actual
- ✅ Incluye correcciones de bugs y mejoras

## 📋 Pasos para Actualizar

### Opción A: Actualizar a Next.js 16 (Última versión)

```bash
# 1. Actualizar Next.js y dependencias relacionadas
npm install next@latest react@latest react-dom@latest

# 2. Actualizar eslint-config-next
npm install --save-dev eslint-config-next@latest

# 3. Verificar que todo funciona
npm run build
```

### Opción B: Actualizar a Next.js 15.2.x (Más seguro)

```bash
# 1. Actualizar solo Next.js a la última versión de la serie 15
npm install next@^15.2.0

# 2. Actualizar eslint-config-next
npm install --save-dev eslint-config-next@^15.2.0

# 3. Verificar que todo funciona
npm run build
```

### Opción C: Actualizar a una versión específica

```bash
# Ejemplo: Actualizar a Next.js 15.2.4
npm install next@15.2.4

# O a Next.js 16.1.4
npm install next@16.1.4
```

## 🔍 Verificar la Versión Instalada

```bash
# Ver versión de Next.js
npm list next

# O verificar en package.json
cat package.json | grep next
```

## 📝 Cambios Necesarios en package.json

Después de actualizar, tu `package.json` debería verse así:

### Para Next.js 16:
```json
{
  "dependencies": {
    "next": "^16.1.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "eslint-config-next": "^16.1.4"
  }
}
```

### Para Next.js 15.2.x:
```json
{
  "dependencies": {
    "next": "^15.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "eslint-config-next": "^15.2.0"
  }
}
```

## ⚙️ Actualizar netlify.toml (Si es necesario)

Si actualizas a Next.js 16, verifica que el plugin de Netlify sea compatible:

```toml
[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "20"
```

## 🧪 Probar Después de Actualizar

1. **Compilar localmente**:
   ```bash
   npm run build
   ```

2. **Ejecutar en desarrollo**:
   ```bash
   npm run dev
   ```

3. **Verificar que no hay errores de TypeScript**:
   ```bash
   npm run lint
   ```

## 🔄 Si Algo Sale Mal

Si encuentras problemas después de actualizar:

```bash
# Revertir a la versión anterior
npm install next@15.1.0

# O restaurar desde package-lock.json
npm ci
```

## 📚 Recursos

- [Next.js Release Notes](https://github.com/vercel/next.js/releases)
- [Next.js Upgrade Guide](https://nextjs.org/docs/app/building-your-application/upgrading)
- [Breaking Changes en Next.js 16](https://nextjs.org/docs/app/building-your-application/upgrading/version-16)
