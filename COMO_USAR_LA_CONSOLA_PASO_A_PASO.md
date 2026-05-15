# 📖 Cómo Usar la Consola del Navegador - Paso a Paso

## 🎯 Objetivo

Ejecutar código JavaScript en la consola del navegador para limpiar el contador de notificaciones.

---

## 📝 Paso a Paso (MUY DETALLADO)

### Paso 1: Abrir las Herramientas de Desarrollador

**Opción A: Con el teclado (MÁS RÁPIDO)**
1. Presiona la tecla **F12** en tu teclado
2. Se abrirá una ventana en la parte inferior o lateral de tu navegador

**Opción B: Con el mouse**
1. **Clic derecho** en cualquier parte de la página
2. Selecciona **"Inspeccionar"** o **"Inspect"** (última opción del menú)

---

### Paso 2: Ir a la Pestaña "Console"

Una vez abiertas las herramientas de desarrollador:

1. **Busca las pestañas en la parte superior** de las herramientas de desarrollador
2. Verás pestañas como: **Elements**, **Console**, **Sources**, **Network**, etc.
3. **Haz clic en la pestaña "Console"** (debería estar en la segunda o tercera posición)

**IMPORTANTE:** 
- ❌ **NO uses "Elements"** (esa es para ver HTML)
- ✅ **USA "Console"** (esa es para ejecutar código JavaScript)

---

### Paso 3: Encontrar el Campo de Texto

En la pestaña "Console":

1. **Busca un campo de texto** en la parte inferior
2. Verás un símbolo **`>`** o **`>>`** seguido de un cursor parpadeante
3. Ese es el lugar donde debes escribir/pegar el código

**Si NO ves el campo de texto:**
- Haz clic en cualquier parte de la consola
- O busca un área que diga "Filter" o "Console" y haz clic ahí

---

### Paso 4: Pegar el Código

1. **Copia este código** (selecciónalo y Ctrl + C):

```javascript
localStorage.clear();
sessionStorage.clear();
window.dispatchEvent(new CustomEvent('notifications-updated', { detail: { forceRefresh: true } }));
setTimeout(() => location.reload(true), 1000);
```

2. **Haz clic en el campo de texto** de la consola (donde está el `>`)
3. **Pega el código** (Ctrl + V)
4. **Presiona Enter**

---

### Paso 5: Ver los Resultados

Después de presionar Enter:

1. Verás mensajes en la consola (pueden ser errores o confirmaciones)
2. La página se recargará automáticamente después de 1 segundo
3. El contador debería desaparecer

---

## 🆘 Si No Puedes Escribir en la Consola

### Problema 1: El Campo Está Deshabilitado

**Solución:**
1. Haz clic en cualquier parte de la consola (área blanca/gris)
2. Presiona cualquier tecla
3. Intenta escribir de nuevo

### Problema 2: No Ves el Campo de Texto

**Solución:**
1. Busca un botón que diga **"Clear console"** o un ícono de limpiar (🗑️)
2. Haz clic ahí para limpiar la consola
3. Luego intenta escribir

### Problema 3: La Consola Está Llena de Errores

**Solución:**
1. Busca un botón que diga **"Clear console"** o presiona **Ctrl + L**
2. Esto limpiará todos los mensajes
3. Luego intenta escribir

---

## 🎯 Alternativa: Recarga Forzada (MÁS FÁCIL)

Si no puedes usar la consola, usa este método más simple:

### Método 1: Recarga Forzada con Teclado

1. **Presiona:** `Ctrl + Shift + R` (Windows) o `Cmd + Shift + R` (Mac)
2. La página se recargará sin caché
3. El contador debería actualizarse

### Método 2: Recarga Forzada con Mouse

1. **Busca el botón de recargar** en la barra de direcciones (ícono circular con flecha)
2. **Clic derecho** en ese botón
3. **Selecciona:** "Vaciar caché y volver a cargar de forma forzada" o "Hard Reload"
4. La página se recargará sin caché

---

## 📸 Dónde Está Cada Cosa

```
┌─────────────────────────────────────────┐
│  [Navegador - Barra de direcciones]     │
│  🔄 ← Botón de recargar (clic derecho)  │
├─────────────────────────────────────────┤
│                                         │
│  [Contenido de la página]               │
│                                         │
├─────────────────────────────────────────┤
│  [Herramientas de Desarrollador - F12] │
│  ┌─────┬──────┬──────┬──────┐          │
│  │Elem │Consol│Networ│...   │ ← Pestañas│
│  │ents │e     │k     │      │          │
│  └─────┴──────┴──────┴──────┘          │
│                                         │
│  [Área de la consola]                   │
│  > │ ← Aquí escribes/pegas el código   │
│                                         │
└─────────────────────────────────────────┘
```

---

## ✅ Checklist

- [ ] Presioné F12 (o clic derecho → Inspeccionar)
- [ ] Vi las herramientas de desarrollador abiertas
- [ ] Hice clic en la pestaña "Console"
- [ ] Vi el campo de texto con el símbolo `>`
- [ ] Hice clic en el campo de texto
- [ ] Pegué el código JavaScript
- [ ] Presioné Enter
- [ ] La página se recargó automáticamente

---

## 🚀 Si Aún No Funciona

**Usa la alternativa más simple:**

1. **Presiona:** `Ctrl + Shift + R`
2. **O clic derecho en el botón de recargar** → "Vaciar caché y volver a cargar de forma forzada"

Esto debería funcionar sin necesidad de usar la consola.

---

**Última actualización**: Enero 2026
