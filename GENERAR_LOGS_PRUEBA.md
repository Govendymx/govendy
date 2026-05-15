# 📋 Guía para Revisar los Logs del Servidor

## 🔍 Dónde Ver los Logs

Los logs de Next.js se muestran en **tiempo real** en la terminal donde ejecutaste `npm run dev`.

### Pasos para Ver los Logs:

1. **Abre la terminal donde está corriendo el servidor**
   - Busca la ventana de PowerShell/CMD donde ejecutaste `npm run dev`
   - O inicia una nueva terminal y ejecuta `npm run dev`

2. **Los logs aparecen automáticamente** cuando:
   - Cargas la página `/dashboard/preguntas`
   - Haces una petición a `/api/questions/list`
   - Respondes una pregunta

---

## 📊 Logs Importantes del Endpoint `/api/questions/list`

Cuando cargas la página de preguntas, deberías ver estos logs en orden:

### 1. Consulta por seller_id
```
[LIST QUESTIONS] Consulta por seller_id: {
  sellerId: '...',
  total: X,
  sample: [...],
  error: null
}
```
**Qué buscar:** 
- ✅ `total` debería mostrar cuántas preguntas tiene el vendedor
- ✅ `error` debería ser `null`

### 2. Consulta por listing_id
```
[LIST QUESTIONS] Consulta por listing_id: {
  listingIdsCount: X,
  total: Y,
  sample: [...]
}
```
**Qué buscar:**
- ✅ `total` debería mostrar preguntas adicionales encontradas por listing_id

### 3. Merge Completado
```
[LIST QUESTIONS] 🔍 MERGE COMPLETADO (igual que /debug): {
  totalEnMapa: X,
  totalEnArray: Y,
  ids: [...],
  coinciden: true
}
```
**Qué buscar:**
- ✅ `totalEnMapa` y `totalEnArray` deberían ser iguales
- ✅ `coinciden` debería ser `true`
- ✅ `ids` debería mostrar todos los IDs de preguntas encontradas

### 4. Estado Antes de Filtrar
```
[LIST QUESTIONS] Estado antes de filtrar: {
  total: X,
  ids: [...],
  muestra: [...],
  todasLasPreguntasConEstado: [...]
}
```
**Qué buscar:**
- ✅ `total` debería ser la suma de todas las preguntas (respondidas + sin responder)
- ✅ Revisa `todasLasPreguntasConEstado` para ver el estado de cada pregunta

### 5. Después de Filtrar
```
[LIST QUESTIONS] 🔍 DESPUÉS DE FILTRAR: {
  totalAllQuestions: X,
  totalUnanswered: Y,  ← ESTE ES EL NÚMERO CRÍTICO
  totalAnswered: Z,
  unansweredIds: [...],
  muestraUnanswered: [...]
}
```
**Qué buscar:**
- ✅ `totalUnanswered` debería mostrar cuántas preguntas sin respuesta hay
- ✅ Si `totalUnanswered` es mayor que 0 pero la UI muestra menos, hay un problema
- ✅ `unansweredIds` debería mostrar los IDs de todas las preguntas sin respuesta

### 6. Después de Mapear
```
[LIST QUESTIONS] 🔍 DESPUÉS DE MAPEAR: {
  totalMapped: X,
  mappedIds: [...],
  muestraMapped: [...]
}
```
**Qué buscar:**
- ✅ `totalMapped` debería ser igual a `totalUnanswered` del paso anterior
- ✅ Si es diferente, se están perdiendo preguntas en el mapeo

### 7. Enviando Respuesta (FINAL)
```
[LIST QUESTIONS] 🚀 ENVIANDO RESPUESTA: {
  questionsCount: X,  ← ESTE ES EL NÚMERO QUE SE ENVÍA
  questionsIds: [...],
  debugInfo: {
    totalInDb: Y,
    unanswered: Z,
    answered: W
  },
  muestraQuestions: [...]
}
```
**Qué buscar:**
- ✅ `questionsCount` es el número FINAL que se envía al frontend
- ✅ Debería ser igual a `totalUnanswered` del paso 5
- ✅ Si `questionsCount` es menor, se están perdiendo preguntas

---

## ⚠️ Problemas Comunes y Qué Buscar

### Problema: "No llegan las preguntas"

**Logs a revisar:**
1. `[LIST QUESTIONS] Consulta por seller_id` → Verificar que `total > 0`
2. `[LIST QUESTIONS] 🔍 DESPUÉS DE FILTRAR` → Verificar `totalUnanswered`
3. `[LIST QUESTIONS] 🚀 ENVIANDO RESPUESTA` → Verificar `questionsCount`

**Si `totalUnanswered > 0` pero `questionsCount = 0`:**
- Hay un problema en el mapeo o filtrado
- Revisa los logs de `DESPUÉS DE MAPEAR`

**Si `totalUnanswered = 0` pero debería haber preguntas:**
- Revisa `Estado antes de filtrar` para ver si las preguntas están siendo marcadas como respondidas incorrectamente
- Verifica que `isQuestionAnswered` esté funcionando correctamente

### Problema: "Las preguntas reaparecen después de responder"

**Logs a revisar:**
1. Después de responder, recarga la página
2. Revisa `[LIST QUESTIONS] 🔍 DESPUÉS DE FILTRAR`
3. Verifica que las preguntas respondidas tengan `isAnswered: true` en los logs

**Si una pregunta respondida aparece con `isAnswered: false`:**
- El `answer_text` no se está guardando correctamente
- Revisa los logs de `/api/questions/answer`

---

## 🧪 Generar Logs de Prueba

Para generar logs y ver qué está pasando:

1. **Abre la página de preguntas:**
   ```
   http://localhost:3000/dashboard/preguntas
   ```

2. **Abre las herramientas de desarrollador (F12)**

3. **Ve a la pestaña Network**

4. **Recarga la página (F5)**

5. **Busca la petición a `/api/questions/list`**

6. **Revisa la respuesta JSON** - debería incluir un objeto `debug` con:
   ```json
   {
     "ok": true,
     "questions": [...],
     "debug": {
       "totalInDb": X,
       "unanswered": Y,
       "answered": Z
     }
   }
   ```

7. **Revisa la consola del servidor** para ver todos los logs detallados

---

## 📝 Ejemplo de Logs Correctos

Si todo funciona bien, deberías ver algo como:

```
[LIST QUESTIONS] Consulta por seller_id: { sellerId: '...', total: 4, ... }
[LIST QUESTIONS] Consulta por listing_id: { total: 11, ... }
[LIST QUESTIONS] 🔍 MERGE COMPLETADO: { totalEnMapa: 11, totalEnArray: 11, coinciden: true }
[LIST QUESTIONS] Estado antes de filtrar: { total: 11, ... }
[LIST QUESTIONS] 🔍 DESPUÉS DE FILTRAR: { totalUnanswered: 8, ... }
[LIST QUESTIONS] 🔍 DESPUÉS DE MAPEAR: { totalMapped: 8, ... }
[LIST QUESTIONS] 🚀 ENVIANDO RESPUESTA: { questionsCount: 8, ... }
```

**Si ves esto, el backend está funcionando correctamente** y el problema está en el frontend o en cómo se muestran las preguntas.

---

## 🆘 Si No Ves Logs

1. **Verifica que el servidor esté corriendo:**
   ```powershell
   Get-Process -Name node
   ```

2. **Reinicia el servidor:**
   ```powershell
   .\verificar-servidor.ps1
   ```

3. **Verifica que estés accediendo al puerto correcto:**
   - Puerto 3000: `http://localhost:3000`
   - Puerto 3001: `http://localhost:3001`

4. **Limpia el caché:**
   ```powershell
   Remove-Item -Recurse -Force .next-dev
   npm run dev
   ```
