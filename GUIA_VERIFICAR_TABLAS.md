# 📋 Guía: Cómo Verificar las Tablas en Supabase

Esta guía te ayudará a acceder a Supabase y verificar las tablas `listings` y `listing_questions` para diagnosticar problemas.

---

## 🔐 Paso 1: Acceder a Supabase

1. **Abre tu navegador** (Chrome, Firefox, Edge, etc.)

2. **Ve a la página de Supabase:**
   - URL: `https://supabase.com`
   - O si ya tienes tu proyecto: `https://app.supabase.com`

3. **Inicia sesión** con tu cuenta de Supabase

4. **Selecciona tu proyecto** (el que corresponde a "Pocket-App")

---

## 📊 Paso 2: Ver la Tabla `listings`

### Opción A: Usando el Table Editor (Más Fácil)

1. En el menú lateral izquierdo, haz clic en **"Table Editor"** (Editor de Tablas)
2. Busca y haz clic en la tabla **`listings`**
3. Verás todas las publicaciones con sus columnas:
   - `id` - ID único de la publicación
   - `seller_id` - ID del vendedor
   - `title` - Título de la publicación
   - `status` - Estado (active, inactive, etc.)
   - `color_variants` - Variantes de color
   - `size_variants` - Variantes de talla
   - Y más...

### Opción B: Usando SQL Editor (Más Avanzado)

1. En el menú lateral, haz clic en **"SQL Editor"** (Editor SQL)
2. Crea una nueva consulta
3. Copia y pega este código:

```sql
-- Ver todas las publicaciones
SELECT 
  id,
  seller_id,
  title,
  status,
  color_variants,
  size_variants,
  created_at
FROM public.listings
ORDER BY created_at DESC
LIMIT 50;
```

4. Haz clic en **"Run"** (Ejecutar) o presiona `Ctrl + Enter`
5. Verás los resultados en una tabla

---

## ❓ Paso 3: Ver la Tabla `listing_questions`

### Opción A: Usando el Table Editor

1. En **"Table Editor"**, busca la tabla **`listing_questions`**
2. Verás todas las preguntas con:
   - `id` - ID único de la pregunta
   - `listing_id` - ID de la publicación relacionada
   - `seller_id` - ID del vendedor
   - `asker_id` - ID de quien hizo la pregunta
   - `question_text` - Texto de la pregunta
   - `answer_text` - Texto de la respuesta (NULL si no tiene)
   - `is_deleted` - Si está eliminada (false = activa)

### Opción B: Usando SQL Editor (Recomendado para Diagnóstico)

1. Ve a **"SQL Editor"**
2. Copia y pega este código para ver **TODAS las preguntas**:

```sql
-- Ver todas las preguntas
SELECT 
  id,
  listing_id,
  seller_id,
  asker_id,
  question_text,
  answer_text,
  is_deleted,
  created_at,
  answered_at
FROM public.listing_questions
ORDER BY created_at DESC;
```

3. Para ver **solo preguntas SIN respuesta**:

```sql
-- Preguntas sin respuesta
SELECT 
  id,
  listing_id,
  seller_id,
  asker_id,
  question_text,
  answer_text,
  is_deleted,
  created_at
FROM public.listing_questions
WHERE is_deleted = false
  AND (answer_text IS NULL OR answer_text = '' OR TRIM(answer_text) = '')
ORDER BY created_at DESC;
```

4. Para ver **preguntas de un vendedor específico** (reemplaza `TU_USER_ID` con tu ID):

```sql
-- Preguntas de un vendedor específico
SELECT 
  q.id,
  q.listing_id,
  q.seller_id,
  q.asker_id,
  q.question_text,
  q.answer_text,
  q.is_deleted,
  l.title as listing_title,
  q.created_at
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.seller_id = 'TU_USER_ID'  -- ⚠️ CAMBIA ESTO por tu user_id
  AND q.is_deleted = false
ORDER BY q.created_at DESC;
```

---

## 🔍 Paso 4: Consulta Útil para Diagnosticar el Problema

Esta consulta te muestra **preguntas sin respuesta agrupadas por vendedor**:

```sql
-- Diagnóstico: Preguntas sin respuesta por vendedor
SELECT 
  q.seller_id,
  COUNT(*) as total_preguntas_sin_respuesta,
  ARRAY_AGG(q.id) as ids_de_preguntas,
  ARRAY_AGG(q.question_text) as textos_de_preguntas
FROM public.listing_questions q
WHERE q.is_deleted = false
  AND (q.answer_text IS NULL OR q.answer_text = '' OR TRIM(q.answer_text) = '')
GROUP BY q.seller_id
ORDER BY total_preguntas_sin_respuesta DESC;
```

---

## 🛠️ Paso 5: Verificar si `seller_id` está Correcto

Esta consulta compara el `seller_id` de las preguntas con el `seller_id` de las publicaciones:

```sql
-- Verificar si seller_id de preguntas coincide con listings
SELECT 
  q.id as pregunta_id,
  q.listing_id,
  q.seller_id as seller_id_en_pregunta,
  l.seller_id as seller_id_en_listing,
  CASE 
    WHEN q.seller_id = l.seller_id THEN '✅ Correcto'
    ELSE '❌ Incorrecto'
  END as estado,
  q.question_text,
  q.answer_text
FROM public.listing_questions q
LEFT JOIN public.listings l ON l.id = q.listing_id
WHERE q.is_deleted = false
ORDER BY q.created_at DESC;
```

---

## 📝 Paso 6: Corregir `seller_id` Incorrecto (Si es Necesario)

Si encuentras preguntas con `seller_id` incorrecto, puedes corregirlas con este SQL:

```sql
-- Corregir seller_id de preguntas usando el seller_id del listing
UPDATE public.listing_questions q
SET seller_id = l.seller_id
FROM public.listings l
WHERE q.listing_id = l.id
  AND (q.seller_id IS NULL OR q.seller_id != l.seller_id)
  AND q.is_deleted = false;
```

**⚠️ IMPORTANTE:** Ejecuta esto solo si estás seguro de que quieres corregir los datos.

---

## 🎯 Resumen Rápido

1. **Accede a Supabase:** `https://app.supabase.com`
2. **Table Editor:** Para ver tablas visualmente
3. **SQL Editor:** Para consultas avanzadas y diagnóstico
4. **Tabla `listings`:** Contiene las publicaciones
5. **Tabla `listing_questions`:** Contiene las preguntas y respuestas

---

## 💡 Consejos

- **Siempre haz clic en "Run"** después de pegar código SQL
- **Puedes copiar los resultados** haciendo clic derecho en la tabla
- **Si no ves una tabla**, puede que no exista o no tengas permisos
- **Guarda consultas útiles** en el SQL Editor para usarlas después

---

## 🆘 Si Tienes Problemas

1. **No puedes acceder a Supabase:**
   - Verifica que tengas la URL correcta
   - Verifica que tu cuenta esté activa

2. **No ves la tabla `listing_questions`:**
   - Ejecuta el script `SOLUCION_DEFINITIVA_PREGUNTAS.sql` en el SQL Editor

3. **No entiendes los resultados:**
   - Comparte una captura de pantalla y te ayudo a interpretarla

---

¿Necesitas ayuda con algo específico? Comparte lo que ves y te ayudo a interpretarlo.
