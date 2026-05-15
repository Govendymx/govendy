# 🔧 Solución de Problemas de Terminal en VS Code

## Error: "The terminal process terminated with exit code: 4294967295"

Este error puede ocurrir por varias razones. Sigue estos pasos para solucionarlo:

---

## ✅ Solución Rápida (Ya aplicada)

Si ya ejecutaste `LIMPIAR_Y_REINICIAR.ps1` y el servidor está funcionando, el problema está resuelto. Este script:
- Detiene procesos de Node.js colgados
- Limpia el caché de Next.js
- Reinicia el servidor correctamente

---

## 🔍 Pasos de Diagnóstico (Si el problema persiste)

### 1. Verificar Configuración de Terminal en VS Code

Abre la configuración de VS Code:
- **File** > **Preferences** > **Settings** (o `Ctrl+,`)
- Busca: `terminal.integrated`

**Configuración recomendada para Windows:**

```json
{
  "terminal.integrated.defaultProfile.windows": "PowerShell",
  "terminal.integrated.profiles.windows": {
    "PowerShell": {
      "source": "PowerShell",
      "icon": "terminal-powershell"
    }
  },
  "terminal.integrated.windowsEnableConpty": true
}
```

### 2. Deshabilitar Modo de Compatibilidad

El modo de compatibilidad puede causar problemas con la terminal:

1. Busca el ejecutable de VS Code (normalmente en `C:\Users\ALEJANDRO\AppData\Local\Programs\Microsoft VS Code\Code.exe`)
2. Clic derecho > **Properties**
3. Pestaña **Compatibility**
4. **Desmarca** "Run this program in compatibility mode"
5. Aplica y reinicia VS Code

### 3. Verificar Antivirus

Algunos antivirus bloquean componentes de la terminal. Si tienes problemas:

**Archivos a excluir del escaneo:**
```
{install_path}\resources\app\node_modules.asar.unpacked\node-pty\build\Release\winpty.dll
{install_path}\resources\app\node_modules.asar.unpacked\node-pty\build\Release\winpty-agent.exe
{install_path}\resources\app\node_modules.asar.unpacked\node-pty\build\Release\conpty.node
{install_path}\resources\app\node_modules.asar.unpacked\node-pty\build\Release\conpty_console_list.node
```

**Para encontrar la ruta de instalación:**
- En VS Code: **Help** > **About**
- O busca: `C:\Users\ALEJANDRO\AppData\Local\Programs\Microsoft VS Code`

### 4. Deshabilitar Consola Legacy (si aplica)

Si usas `cmd.exe`:

1. Abre `cmd.exe` desde el menú de inicio
2. Clic derecho en la barra de título > **Properties**
3. Pestaña **Options**
4. **Desmarca** "Use legacy console"

### 5. Probar PowerShell Directamente

Abre PowerShell fuera de VS Code y ejecuta:

```powershell
# Verificar que PowerShell funciona
$PSVersionTable

# Probar Node.js
node --version
npm --version

# Si funciona fuera de VS Code, el problema es de configuración de VS Code
```

---

## 🛠️ Soluciones Alternativas

### Opción 1: Usar Terminal Externa

Si la terminal integrada sigue fallando, puedes usar una terminal externa:

1. Abre PowerShell o CMD fuera de VS Code
2. Navega a tu proyecto:
   ```powershell
   cd "C:\Users\ALEJANDRO\Documents\Pocket-App"
   ```
3. Ejecuta el script:
   ```powershell
   .\LIMPIAR_Y_REINICIAR.ps1
   ```

### Opción 2: Habilitar Logging de Terminal

Para diagnosticar el problema:

1. Abre Command Palette (`Ctrl+Shift+P`)
2. Busca: `Preferences: Open User Settings (JSON)`
3. Agrega:
   ```json
   {
     "terminal.integrated.logLevel": "debug"
   }
   ```
4. Intenta abrir la terminal
5. Revisa los logs en: **View** > **Output** > Selecciona "Log (Window)"

### Opción 3: Actualizar VS Code

Asegúrate de tener la versión más reciente:

- **Help** > **Check for Updates**
- O descarga desde: https://code.visualstudio.com/

---

## 📋 Checklist de Verificación

- [ ] VS Code está actualizado
- [ ] Modo de compatibilidad deshabilitado
- [ ] Antivirus no bloquea componentes de terminal
- [ ] PowerShell funciona fuera de VS Code
- [ ] Configuración de terminal es correcta
- [ ] Caché de Next.js limpiado (`.next`, `.next-dev`)
- [ ] Procesos de Node.js no están colgados

---

## 🚀 Scripts Disponibles

### `LIMPIAR_Y_REINICIAR.ps1`
Limpia caché y reinicia el servidor. **Úsalo cuando tengas problemas.**

### `INICIAR_SERVIDOR.ps1`
Inicia el servidor normalmente. Úsalo cuando todo funciona bien.

---

## 📚 Referencias

- [Documentación oficial de VS Code](https://aka.ms/vscode-troubleshoot-terminal-launch)
- [Guía de Terminal Integrada](https://code.visualstudio.com/docs/terminal/basics)

---

## 💡 Consejos

1. **Siempre usa los scripts PowerShell** en lugar de ejecutar comandos directamente en la terminal integrada si tienes problemas
2. **Mantén VS Code actualizado** - cada versión incluye mejoras de terminal
3. **Si el problema persiste**, reporta el issue con logs habilitados

---

## ⚠️ Códigos de Salida Comunes

- **4294967295** (0xFFFFFFFF): Error genérico de Windows, generalmente relacionado con procesos bloqueados o antivirus
- **259**: STILL_ACTIVE - Proceso aún activo
- **3221225786**: Consola legacy habilitada
- **1**: Error genérico del shell

---

**Última actualización:** Enero 2026
