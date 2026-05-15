# 🗑️ Instrucciones para Eliminar Todas las Preguntas

## Opción 1: Soft Delete (RECOMENDADO) ✅

Esta opción marca las preguntas como eliminadas pero las mantiene en la base de datos por si necesitas recuperarlas.

### Pasos:
1. Abre Supabase → SQL Editor
2. Copia y pega el contenido de `ELIMINAR_TODAS_LAS_PREGUNTAS.sql`
3. Ejecuta el script
4. Verifica que el resultado muestre que todas las preguntas fueron marcadas como eliminadas

### Ventajas:
- ✅ Reversible (puedes recuperar las preguntas si es necesario)
- ✅ Mantiene el historial
- ✅ Más seguro

---

## Opción 2: Eliminación Física ⚠️

Esta opción borra las preguntas **PERMANENTEMENTE** de la base de datos.

### Pasos:
1. Abre Supabase → SQL Editor
2. Copia y pega el contenido de `ELIMINAR_TODAS_LAS_PREGUNTAS_FISICO.sql`
3. **Lee bien el script antes de ejecutarlo**
4. Ejecuta el script
5. Verifica que el resultado muestre 0 preguntas restantes

### ⚠️ ADVERTENCIA:
- ❌ **NO ES REVERSIBLE**
- ❌ Los datos se pierden permanentemente
- ❌ No podrás recuperar las preguntas después

---

## Después de Eliminar

1. **Recarga la página de preguntas** en tu aplicación
2. Deberías ver "Pendientes: 0" o un mensaje indicando que no hay preguntas
3. **Crea nuevas preguntas** para probar el sistema
4. Verifica que:
   - Las nuevas preguntas aparecen correctamente
   - Puedes responderlas
   - Desaparecen después de responder
   - No reaparecen al recargar la página

---

## Si Necesitas Recuperar Preguntas (Solo Soft Delete)

Si usaste la Opción 1 y necesitas recuperar las preguntas:

```sql
-- Recuperar todas las preguntas eliminadas
UPDATE public.listing_questions
SET is_deleted = false
WHERE is_deleted = true;
```

---

## Verificación

Después de eliminar, ejecuta esto para verificar:

```sql
SELECT 
  COUNT(*) FILTER (WHERE is_deleted = false) as activas,
  COUNT(*) FILTER (WHERE is_deleted = true) as eliminadas,
  COUNT(*) as total
FROM public.listing_questions;
```

Si todo está bien:
- **Con Soft Delete**: `activas = 0`, `eliminadas = [número de preguntas que había]`
- **Con Eliminación Física**: `total = 0`
