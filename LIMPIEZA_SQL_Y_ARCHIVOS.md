# Limpieza: SQL y archivos a borrar para evitar conflictos

Este documento indica **qué archivos se han borrado** (o debes borrar) y **qué conservar**. Objetivo: eliminar SQL y código obsoleto, peligroso o redundante para evitar conflictos.

---

## ✅ CONSERVAR (no borrar)

### SQL que la app usa o menciona en errores

- `TODOS_LOS_SQL_CONSOLIDADOS.sql` — script único para Supabase.
- `supabase_*.sql` — migraciones y esquema (profiles, listings, orders, notifications, etc.). La app y `consolidar-sql.js` los usan.
- `ejecutar-sql.ps1` — ejecuta el consolidado.
- `consolidar-sql.js` — genera `TODOS_LOS_SQL_CONSOLIDADOS.sql` desde los `supabase_*.sql`.

### Otros útiles

- `ORDEN_EJECUCION_SQL.md` — orden de ejecución de SQL.
- `GUIA_VERIFICAR_TABLAS.md`, `GUIA_DEPLOYMENT.md` — guías de uso.

---

## ❌ BORRAR (obsoleto, peligroso o redundante)

### 1. SQL peligroso o de limpieza agresiva

Estos scripts **eliminan datos** (notificaciones, preguntas, etc.). Evitan conflictos si se borran del repo para que nadie los ejecute por error:

| Archivo | Motivo |
|--------|--------|
| `ELIMINAR_TODO_AGRESIVO.sql` | Borra todas las notificaciones sin filtro. Peligroso. |
| `ELIMINAR_TODAS_NOTIFICACIONES_ATORADAS.sql` | Limpieza agresiva. |
| `ELIMINAR_TODAS_NOTIFICACIONES_NO_LEIDAS.sql` | Idem. |
| `ELIMINAR_TODAS_NOTIFICACIONES_USUARIO.sql` | Idem. |
| `ELIMINAR_TODAS_LAS_PREGUNTAS.sql` | Borra todas las preguntas. |
| `ELIMINAR_TODAS_LAS_PREGUNTAS_SIMPLE.sql` | Idem. |
| `ELIMINAR_TODAS_LAS_PREGUNTAS_FISICO.sql` | Idem. |
| `ELIMINAR_NOTIFICACIONES_*.sql` (todos) | Variantes de “eliminar notificaciones”; redundantes y arriesgadas. |
| `ELIMINAR_MIS_NOTIFICACIONES.sql` | La app ya no lo referencia; sustituido por mensajes genéricos. |
| `ELIMINAR_PREGUNTAS_FECHAS_FUTURAS.sql` | Limpieza puntual, no parte del flujo. |
| `BUSCAR_Y_ELIMINAR_NOTIFICACIONES_ATORADAS.sql` | Diagnóstico + borrado; obsoleto. |

### 2. SQL de diagnóstico / verificación (redundante)

Solo para depurar; no forman parte del flujo normal. Borrarlos reduce ruido:

- `DIAGNOSTICAR_*.sql`
- `DIAGNOSTICO_*.sql`
- `VERIFICAR_*.sql` (todos)
- `VER_PREGUNTAS_*.sql`, `VER_NOTIFICACIONES_*.sql`

### 3. SQL de “fix” puntual (antiguos)

Sustituidos por el consolidado y las migraciones actuales:

- `FIX_*.sql`
- `CORREGIR_*.sql`
- `SOLUCION_*.sql` (todos)
- `ARREGLAR_*.sql`
- `CONFIGURACION_COMPLETA_NOTIFICACIONES_Y_PREGUNTAS.sql`
- `CREAR_NOTIFICACION_PRUEBA.sql`, `CREAR_NOTIFICACIONES_FALTANTES.sql`
- `RECONSTRUIR_SISTEMA_NOTIFICACIONES.sql`
- `FUNCION_ACTUALIZAR_RESPUESTA.sql`, `TEST_FUNCION_SQL.sql`
- `LIMPIEZA_COMPLETA_ANSWERED_AT.sql`
- `LIMPIAR_*.sql`, `LIMPIAR_DUPLICADOS_*.sql`

### 4. SQL de utilidad puntual (opcional borrar)

- `OBTENER_MI_USER_ID.sql`, `OBTENER_MI_USER_ID_POR_EMAIL.sql`
- `IDENTIFICAR_USUARIO_DESCONOCIDO.sql`
- `AGREGAR_ADMIN*.sql`, `AGREGAR_ADMINISTRADOR*.sql` — si ya tienes admins y no usas estos scripts, se pueden borrar.

### 5. Scripts y .md obsoletos (ya borrados)

- `fix-policies.js` — utilidad interna para RLS.
- `FORZAR_LIMPIAR_CONTADOR.js` — workaround para contador.
- `ejecutar-todos-sql.js` — redundante con `ejecutar-sql.ps1` + consolidado.
- `.md` obsoletos: `SOLUCION_FINAL_NOTIFICACIONES_ATORADAS`, `FORZAR_ACTUALIZACION_NOTIFICACIONES`, `SOLUCION_LIMPIAR_NOTIFICACIONES`, `REFERENCIAS_NOTIFICACIONES`, `RESUMEN_VERIFICACION_COMPLETA`, `RESUMEN_SOLUCION_FINAL`, `SOLUCION_DEFINITIVA_PREGUNTAS`, `SOLUCION_DEFINITIVA_VOLVER_APARECER`, `SOLUCION_BOTON_LIMPIAR`, `SOLUCION_NOTIFICACIONES_ANTIGUAS`, `SOLUCION_NOTIFICACIONES`, `SOLUCION_NOTIFICACIONES_VUELVEN`, `SOLUCION_FINAL_PREGUNTAS`, `SOLUCION_FINAL_RESPONDER_PREGUNTAS`, `RESUMEN_CONTADOR_NOTIFICACIONES`, `EXPLICACION_CONTADOR_NOTIFICACIONES`, `INSTRUCCIONES_ELIMINAR_PREGUNTAS`.

---

## Cambios en el código

- **AccountTopMenu** y **API notifications/delete**: se dejaron de mencionar `ELIMINAR_MIS_NOTIFICACIONES.sql` y `DIAGNOSTICAR_Y_ELIMINAR_NOTIFICACIONES_ATORADAS.sql`. Los mensajes de error ahora son genéricos (revisar RLS / contactar administrador).
- Las APIs siguen indicando los `supabase_*.sql` concretos cuando falta una tabla o columna (por ejemplo `supabase_listings_soft_delete.sql`, `supabase_orders_logistics.sql`). Esos **no** se borran.

---

## Cómo aplicar la limpieza

1. Borrar los archivos listados en **BORRAR** (ya aplicado en el repo si se ejecutó el script de limpieza).
2. **No** borrar `supabase_*.sql` ni `TODOS_LOS_SQL_CONSOLIDADOS.sql`.
3. Mantener `consolidar-sql.js` y `ejecutar-sql.ps1` para generar y ejecutar el consolidado.

Si algo no está en este listado y dudas, **conservarlo** hasta confirmar que no se usa.
