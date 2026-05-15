# Solución para Error de Terminal y Crashes del Servicio de Lenguaje

## Problema
- Terminal termina con código de salida: `4294967295`
- Servicio de lenguaje JS/TS se estrelló 5 veces en 5 minutos

## Soluciones (en orden de prioridad)

### 1. Limpiar archivos de build y caché

Ejecuta estos comandos en PowerShell (uno por uno):

```powershell
# Detener cualquier proceso de Next.js que esté corriendo
# Presiona Ctrl+C si hay algo corriendo

# Eliminar carpeta de build
Remove-Item -Recurse -Force .next-dev -ErrorAction SilentlyContinue

# Eliminar node_modules (opcional, solo si el problema persiste)
# Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# Limpiar caché de npm
npm cache clean --force

# Reinstalar dependencias (solo si eliminaste node_modules)
# npm install
```

### 2. Reiniciar el Servidor de Lenguaje TypeScript

En VS Code/Cursor:
1. Presiona `Ctrl + Shift + P` (o `Cmd + Shift + P` en Mac)
2. Escribe: `TypeScript: Restart TS Server`
3. Presiona Enter

### 3. Cerrar y reabrir VS Code/Cursor

1. Cierra completamente VS Code/Cursor
2. Espera 10 segundos
3. Vuelve a abrirlo

### 4. Verificar memoria disponible

El servicio de lenguaje puede estar quedándose sin memoria. Verifica:
- Cierra otras aplicaciones pesadas
- Reinicia tu computadora si es necesario

### 5. Verificar configuración de TypeScript

Asegúrate de que `tsconfig.json` esté correcto (ya lo revisamos, está bien).

### 6. Si el problema persiste

Ejecuta estos comandos para un reset completo:

```powershell
# Ir al directorio del proyecto
cd C:\Users\ALEJANDRO\Documents\Pocket-App

# Eliminar todo lo relacionado con builds
Remove-Item -Recurse -Force .next-dev -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# Limpiar npm
npm cache clean --force

# Reinstalar
npm install

# Intentar build
npm run build
```

## Prevención

1. **No edites archivos en `.next-dev`** - Son generados automáticamente
2. **Cierra el servidor de desarrollo** antes de hacer cambios grandes
3. **Reinicia el servidor de TypeScript** si ves errores raros

## Si nada funciona

1. Reinicia tu computadora
2. Abre VS Code/Cursor de nuevo
3. Abre solo el proyecto Pocket-App (no otros proyectos)
4. Intenta de nuevo
