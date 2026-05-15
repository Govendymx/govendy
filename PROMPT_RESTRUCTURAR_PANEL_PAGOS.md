# Prompt: Reestructurar Panel de Administrador - Submenú PAGOS

## 🎯 Objetivo

Reestructurar completamente el panel de administrador en el submenú **PAGOS** (`/admin/pagos`) para que sea:
1. **Más funcional**: Botones claros y acciones rápidas
2. **Más claro**: Información organizada y fácil de entender
3. **Con alertas**: Indicadores visuales de lo que necesita atención inmediata

---

## 🔍 Análisis del Estado Actual

### Problemas Identificados
- ❌ Botones pequeños y poco visibles
- ❌ No hay alertas visuales de urgencia
- ❌ Información dispersa en tabla larga
- ❌ No hay resumen de lo que necesita atención
- ❌ Acciones importantes no destacadas
- ❌ No hay indicadores de prioridad

### Funcionalidades Actuales
- ✅ Lista de pagos offline
- ✅ Filtros por estado (Todos, Pendientes, Pagados, Cancelados)
- ✅ Acciones: Marcar pagado, Forzar, Cancelar, Ver hoja, Ver ticket
- ✅ Modal de confirmación para marcar como pagado

---

## ✨ Diseño Propuesto

### 1. **Header con Resumen y Alertas**

**Ubicación**: Parte superior de la página

**Componentes**:
- **Tarjetas de resumen** (KPIs):
  - Total de pagos pendientes (con badge de alerta si > 0)
  - Pagos pendientes > 24 horas (URGENTE - rojo)
  - Pagos pendientes > 48 horas (CRÍTICO - rojo oscuro)
  - Pagos sin comprobante (AMARILLO - necesita revisión)
  - Total de pagos hoy
  - Monto total pendiente

- **Alertas destacadas**:
  - Banner rojo si hay pagos > 48 horas pendientes
  - Banner amarillo si hay pagos sin comprobante
  - Banner azul con información general

### 2. **Filtros Mejorados**

**Ubicación**: Debajo del header

**Filtros propuestos**:
- **Por Urgencia**:
  - 🔴 Urgentes (> 48h)
  - 🟡 Revisar (> 24h)
  - 🟢 Nuevos (< 24h)
  - Todos

- **Por Estado** (actual, mejorado):
  - Pendientes (con contador)
  - Pagados (con contador)
  - Cancelados (con contador)
  - Todos

- **Por Método de Pago**:
  - Transferencia
  - Depósito bancario
  - OXXO
  - Todos

- **Por Comprobante**:
  - Con comprobante
  - Sin comprobante (necesita atención)
  - Todos

### 3. **Tabla Mejorada con Indicadores Visuales**

**Mejoras propuestas**:

#### Columnas Reorganizadas:
1. **⚠️ Urgencia** (nueva columna)
   - Badge rojo: > 48h pendiente
   - Badge amarillo: > 24h pendiente
   - Badge verde: < 24h
   - Badge gris: Pagado/Cancelado

2. **Referencia** (mejorada)
   - Código de referencia grande y visible
   - ID pequeño debajo
   - Badge si es sesión virtual

3. **Producto** (mejorada)
   - Nombre del producto destacado
   - Link al producto
   - Cantidad de órdenes visible

4. **Comprador** (nueva columna)
   - Nombre del comprador (si está disponible)
   - ID del comprador
   - Link al perfil

5. **Monto y Desglose** (mejorada)
   - Monto total grande
   - Desglose: Subtotal, Comisión, Envío, Neto
   - Tooltip con detalles

6. **Estado** (mejorada)
   - Badge grande y claro
   - Fecha de creación
   - Fecha de pago (si aplica)
   - Quién autorizó (si aplica)

7. **Comprobante** (nueva columna)
   - Badge verde: "Comprobante subido"
   - Badge amarillo: "Sin comprobante" (necesita atención)
   - Botón para ver comprobante
   - Fecha de subida

8. **Acciones** (mejorada)
   - Botones más grandes y claros
   - Agrupados por tipo de acción
   - Iconos descriptivos

### 4. **Botones Mejorados y Más Funcionales**

#### Botones Principales (por fila):

**Para Pagos Pendientes:**
1. **✅ Marcar como Pagado** (Verde grande)
   - Icono de check
   - Texto claro
   - Modal mejorado con:
     - Resumen del pago
     - Monto destacado
     - Información del comprador
     - Campo para nombre del admin
     - Checkbox de confirmación

2. **🔍 Ver Detalles** (Azul)
   - Modal con información completa:
     - Datos del comprador
     - Productos incluidos
     - Historial de estados
     - Comprobante (si existe)
     - Notas del admin

3. **📄 Ver Hoja de Pago** (Gris)
   - Link a la hoja de pago PDF

4. **📎 Ver Comprobante** (Rosa, solo si existe)
   - Abrir comprobante en nueva pestaña

5. **⚠️ Forzar Aprobación** (Rojo, solo si es necesario)
   - Con advertencia clara
   - Requiere doble confirmación

6. **❌ Cancelar** (Gris oscuro)
   - Con confirmación

**Para Pagos Pagados:**
1. **↩️ Marcar como No Pagado** (Amarillo)
   - Con confirmación y razón

2. **🔍 Ver Detalles** (Azul)

3. **📄 Ver Hoja de Pago** (Gris)

4. **📎 Ver Comprobante** (Rosa)

### 5. **Sistema de Alertas Visuales**

#### Alertas por Prioridad:

**🔴 Crítico (Rojo)**:
- Pagos pendientes > 48 horas
- Pagos sin comprobante > 24 horas
- Montos altos sin comprobante

**🟡 Atención (Amarillo)**:
- Pagos pendientes > 24 horas
- Pagos sin comprobante
- Pagos con comprobante pero sin revisar

**🟢 Normal (Verde)**:
- Pagos pendientes < 24 horas
- Pagos con comprobante subido

**⚪ Información (Gris)**:
- Pagos pagados
- Pagos cancelados

#### Indicadores Visuales:
- **Borde izquierdo de color** en cada fila según urgencia
- **Badge de urgencia** en la primera columna
- **Iconos** que indiquen el tipo de atención necesaria
- **Animación sutil** en filas que necesitan atención

### 6. **Acciones Rápidas (Bulk Actions)**

**Ubicación**: Barra superior de la tabla

**Acciones propuestas**:
- **Seleccionar múltiples pagos** (checkbox)
- **Marcar múltiples como pagados** (con confirmación)
- **Exportar seleccionados** (CSV/Excel)
- **Filtrar por rango de fechas**
- **Búsqueda rápida** (por referencia, comprador, producto)

---

## 📐 Estructura de Componentes Propuesta

```
components/admin/payments/
├── PaymentDashboard.tsx          # Componente principal
├── PaymentSummaryCards.tsx       # Tarjetas de resumen (KPIs)
├── PaymentAlerts.tsx             # Banner de alertas
├── PaymentFilters.tsx             # Filtros mejorados
├── PaymentTable.tsx               # Tabla mejorada
├── PaymentRow.tsx                 # Fila individual con indicadores
├── PaymentActions.tsx             # Botones de acción mejorados
├── PaymentDetailModal.tsx         # Modal de detalles completo
├── PaymentConfirmModal.tsx        # Modal de confirmación mejorado
└── PaymentUrgencyBadge.tsx        # Badge de urgencia
```

---

## 🎨 Diseño Visual Propuesto

### Header con Resumen

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  {/* KPI Card: Pendientes Urgentes */}
  <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-4">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs font-semibold text-red-700">URGENTES</div>
        <div className="text-2xl font-bold text-red-900">{urgentCount}</div>
        <div className="text-xs text-red-600">> 48 horas</div>
      </div>
      <div className="text-3xl">🔴</div>
    </div>
  </div>

  {/* KPI Card: Pendientes Revisar */}
  <div className="rounded-2xl bg-amber-50 border-2 border-amber-200 p-4">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs font-semibold text-amber-700">REVISAR</div>
        <div className="text-2xl font-bold text-amber-900">{reviewCount}</div>
        <div className="text-xs text-amber-600">> 24 horas</div>
      </div>
      <div className="text-3xl">🟡</div>
    </div>
  </div>

  {/* KPI Card: Sin Comprobante */}
  <div className="rounded-2xl bg-yellow-50 border-2 border-yellow-200 p-4">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs font-semibold text-yellow-700">SIN COMPROBANTE</div>
        <div className="text-2xl font-bold text-yellow-900">{noProofCount}</div>
        <div className="text-xs text-yellow-600">Necesita atención</div>
      </div>
      <div className="text-3xl">📎</div>
    </div>
  </div>

  {/* KPI Card: Total Pendiente */}
  <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-4">
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs font-semibold text-blue-700">MONTO PENDIENTE</div>
        <div className="text-2xl font-bold text-blue-900">
          {formatMoney(totalPendingAmount)}
        </div>
        <div className="text-xs text-blue-600">{totalPendingCount} pagos</div>
      </div>
      <div className="text-3xl">💰</div>
    </div>
  </div>
</div>
```

### Banner de Alertas

```tsx
{/* Alerta Crítica */}
{criticalPayments.length > 0 && (
  <div className="rounded-2xl bg-red-100 border-2 border-red-300 p-4 mb-4">
    <div className="flex items-center gap-3">
      <div className="text-2xl">🚨</div>
      <div className="flex-1">
        <div className="font-bold text-red-900">
          ATENCIÓN URGENTE: {criticalPayments.length} pago(s) pendiente(s) por más de 48 horas
        </div>
        <div className="text-sm text-red-700 mt-1">
          Estos pagos requieren revisión inmediata. Monto total: {formatMoney(criticalAmount)}
        </div>
      </div>
      <button
        onClick={() => setStatusFilter('urgent')}
        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
      >
        Ver Urgentes
      </button>
    </div>
  </div>
)}

{/* Alerta Sin Comprobante */}
{noProofPayments.length > 0 && (
  <div className="rounded-2xl bg-yellow-100 border-2 border-yellow-300 p-4 mb-4">
    <div className="flex items-center gap-3">
      <div className="text-2xl">⚠️</div>
      <div className="flex-1">
        <div className="font-bold text-yellow-900">
          {noProofPayments.length} pago(s) sin comprobante subido
        </div>
        <div className="text-sm text-yellow-700 mt-1">
          Los compradores aún no han subido el comprobante de pago
        </div>
      </div>
      <button
        onClick={() => setStatusFilter('no_proof')}
        className="rounded-xl bg-yellow-600 px-4 py-2 text-sm font-bold text-white hover:bg-yellow-700"
      >
        Ver Sin Comprobante
      </button>
    </div>
  </div>
)}
```

### Filtros Mejorados

```tsx
<div className="flex flex-wrap items-center gap-3 mb-4">
  {/* Filtro por Urgencia */}
  <div className="flex gap-2">
    <span className="text-xs font-semibold text-gray-700 self-center">Urgencia:</span>
    <button
      onClick={() => setUrgencyFilter('critical')}
      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
        urgencyFilter === 'critical'
          ? 'bg-red-600 text-white shadow-sm'
          : 'bg-white text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50'
      }`}
    >
      🔴 Críticos
    </button>
    <button
      onClick={() => setUrgencyFilter('review')}
      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
        urgencyFilter === 'review'
          ? 'bg-amber-500 text-white shadow-sm'
          : 'bg-white text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50'
      }`}
    >
      🟡 Revisar
    </button>
    <button
      onClick={() => setUrgencyFilter('new')}
      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
        urgencyFilter === 'new'
          ? 'bg-green-500 text-white shadow-sm'
          : 'bg-white text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50'
      }`}
    >
      🟢 Nuevos
    </button>
    <button
      onClick={() => setUrgencyFilter('')}
      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
        !urgencyFilter
          ? 'bg-gray-600 text-white shadow-sm'
          : 'bg-white text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50'
      }`}
    >
      Todos
    </button>
  </div>

  {/* Filtro por Estado */}
  <div className="flex gap-2">
    <span className="text-xs font-semibold text-gray-700 self-center">Estado:</span>
    <button
      onClick={() => setStatusFilter('pending')}
      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
        statusFilter === 'pending'
          ? 'bg-amber-500 text-white shadow-sm'
          : 'bg-white text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50'
      }`}
    >
      Pendientes ({pendingCount})
    </button>
    {/* ... más botones de estado ... */}
  </div>

  {/* Filtro por Comprobante */}
  <div className="flex gap-2">
    <span className="text-xs font-semibold text-gray-700 self-center">Comprobante:</span>
    <button
      onClick={() => setProofFilter('no_proof')}
      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
        proofFilter === 'no_proof'
          ? 'bg-yellow-500 text-white shadow-sm'
          : 'bg-white text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50'
      }`}
    >
      Sin comprobante ({noProofCount})
    </button>
    {/* ... más opciones ... */}
  </div>
</div>
```

### Tabla con Indicadores Visuales

```tsx
<tbody className="divide-y divide-black/5 bg-white">
  {rows.map((payment) => {
    const urgency = calculateUrgency(payment);
    const hasProof = Boolean(payment.payment_proof_url);
    const hoursPending = calculateHoursPending(payment);
    
    return (
      <tr
        key={payment.id}
        className={`
          hover:bg-gray-50 transition-colors
          ${urgency === 'critical' ? 'border-l-4 border-l-red-600 bg-red-50/30' : ''}
          ${urgency === 'review' ? 'border-l-4 border-l-amber-500 bg-amber-50/30' : ''}
          ${urgency === 'new' ? 'border-l-4 border-l-green-500' : ''}
          ${!hasProof && payment.status === 'pending' ? 'ring-2 ring-yellow-300' : ''}
        `}
      >
        {/* Columna: Urgencia */}
        <td className="px-4 py-4">
          <UrgencyBadge urgency={urgency} hours={hoursPending} />
        </td>

        {/* Columna: Referencia */}
        <td className="px-4 py-4">
          <div className="text-lg font-bold text-gray-900">
            {payment.reference_code || 'Sin referencia'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            ID: {payment.id.slice(0, 8)}…
          </div>
          {payment.is_virtual && (
            <span className="inline-block mt-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800">
              Virtual
            </span>
          )}
        </td>

        {/* Columna: Comprador */}
        <td className="px-4 py-4">
          <div className="text-sm font-semibold text-gray-900">
            {buyerName || 'Comprador'}
          </div>
          <div className="text-xs text-gray-500">
            {payment.buyer_id.slice(0, 8)}…
          </div>
          <Link
            href={`/admin/usuarios?user=${payment.buyer_id}`}
            className="text-xs text-brand-pink hover:underline mt-1 inline-block"
          >
            Ver perfil →
          </Link>
        </td>

        {/* Columna: Monto */}
        <td className="px-4 py-4">
          <div className="text-lg font-bold text-gray-900">
            {formatMoney(payment.amount)}
          </div>
          <details className="mt-1">
            <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
              Ver desglose
            </summary>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Comisión:</span>
                <span className="font-semibold">{formatMoney(payment.commission_total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Envío:</span>
                <span className="font-semibold">{formatMoney(payment.shipping_total)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span>Neto:</span>
                <span className="font-bold">{formatMoney(payment.net_total)}</span>
              </div>
            </div>
          </details>
        </td>

        {/* Columna: Comprobante */}
        <td className="px-4 py-4">
          {hasProof ? (
            <div className="space-y-2">
              <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                ✓ Comprobante subido
              </span>
              <a
                href={payment.payment_proof_url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-100 text-center"
              >
                📎 Ver comprobante
              </a>
              {payment.payment_proof_uploaded_at && (
                <div className="text-[10px] text-gray-500">
                  Subido: {formatDateTime(payment.payment_proof_uploaded_at)}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <span className="inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800 ring-2 ring-yellow-300">
                ⚠️ Sin comprobante
              </span>
              <div className="text-[10px] text-yellow-700">
                Esperando comprobante del comprador
              </div>
            </div>
          )}
        </td>

        {/* Columna: Estado */}
        <td className="px-4 py-4">
          <div className="space-y-1">
            {renderStatus(payment.status)}
            <div className="text-xs text-gray-600">
              Creado: {formatDateTime(payment.created_at)}
            </div>
            {payment.paid_confirmed_at && (
              <>
                <div className="text-xs text-gray-600">
                  Pagado: {formatDateTime(payment.paid_confirmed_at)}
                </div>
                {payment.paid_confirmed_by_name && (
                  <div className="text-xs text-gray-500">
                    Por: {payment.paid_confirmed_by_name}
                  </div>
                )}
              </>
            )}
          </div>
        </td>

        {/* Columna: Acciones Mejoradas */}
        <td className="px-4 py-4">
          <PaymentActions
            payment={payment}
            onAction={handleAction}
            isSaving={isSaving}
          />
        </td>
      </tr>
    );
  })}
</tbody>
```

### Componente de Acciones Mejorado

```tsx
function PaymentActions({ payment, onAction, isSaving }: Props) {
  const status = String(payment.status || '').trim().toLowerCase();
  const hasProof = Boolean(payment.payment_proof_url);
  
  if (status === 'paid') {
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <button
          onClick={() => onAction(payment.id, 'mark_unpaid')}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-bold text-amber-900 hover:bg-amber-200 transition"
        >
          <span>↩️</span>
          <span>Marcar No Pagado</span>
        </button>
        <Link
          href={`/pago/${payment.id}`}
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition"
        >
          <span>📄</span>
          <span>Ver Hoja de Pago</span>
        </Link>
        {hasProof && (
          <a
            href={payment.payment_proof_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-pink-100 px-4 py-2.5 text-sm font-semibold text-pink-900 hover:bg-pink-200 transition"
          >
            <span>📎</span>
            <span>Ver Comprobante</span>
          </a>
        )}
      </div>
    );
  }
  
  if (status === 'pending') {
    return (
      <div className="flex flex-col gap-2 min-w-[200px]">
        <button
          onClick={() => onAction(payment.id, 'mark_paid')}
          className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 shadow-lg transition"
        >
          <span>✅</span>
          <span>Marcar como Pagado</span>
        </button>
        <button
          onClick={() => openDetailModal(payment.id)}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-100 px-4 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-200 transition"
        >
          <span>🔍</span>
          <span>Ver Detalles</span>
        </button>
        <Link
          href={`/pago/${payment.id}`}
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition"
        >
          <span>📄</span>
          <span>Ver Hoja de Pago</span>
        </Link>
        {hasProof ? (
          <a
            href={payment.payment_proof_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-pink-100 px-4 py-2.5 text-sm font-semibold text-pink-900 hover:bg-pink-200 transition"
          >
            <span>📎</span>
            <span>Ver Comprobante</span>
          </a>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-yellow-100 px-4 py-2.5 text-sm font-semibold text-yellow-900">
            <span>⚠️</span>
            <span>Sin Comprobante</span>
          </div>
        )}
        <button
          onClick={() => onAction(payment.id, 'force')}
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition"
        >
          <span>⚠️</span>
          <span>Forzar Aprobación</span>
        </button>
        <button
          onClick={() => onAction(payment.id, 'cancel')}
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 transition"
        >
          <span>❌</span>
          <span>Cancelar</span>
        </button>
      </div>
    );
  }
  
  // ... otros estados
}
```

### Modal de Confirmación Mejorado

```tsx
function PaymentConfirmModal({ payment, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Confirmar Pago
        </h3>
        
        {/* Resumen del Pago */}
        <div className="rounded-2xl bg-gray-50 p-4 mb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-600">Referencia</div>
              <div className="text-lg font-bold text-gray-900">
                {payment.reference_code || 'Sin referencia'}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600">Monto Total</div>
              <div className="text-lg font-bold text-green-600">
                {formatMoney(payment.amount)}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600">Método</div>
              <div className="text-sm font-semibold text-gray-900">
                {labelMethod(payment.payment_method)}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-600">Comprador</div>
              <div className="text-sm font-semibold text-gray-900">
                {buyerName || 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Desglose */}
        <div className="rounded-xl border border-gray-200 p-3 mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">Desglose:</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatMoney(payment.orders_total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Comisión:</span>
              <span className="text-red-600">-{formatMoney(payment.commission_total)}</span>
            </div>
            <div className="flex justify-between">
              <span>Envío:</span>
              <span className="text-red-600">-{formatMoney(payment.shipping_total)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-bold">
              <span>Neto para vendedor:</span>
              <span className="text-green-600">{formatMoney(payment.net_total)}</span>
            </div>
          </div>
        </div>

        {/* Comprobante */}
        {payment.payment_proof_url ? (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span className="text-sm font-semibold text-green-900">
                Comprobante disponible
              </span>
              <a
                href={payment.payment_proof_url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-green-700 hover:underline"
              >
                Ver comprobante →
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-yellow-600">⚠️</span>
              <span className="text-sm font-semibold text-yellow-900">
                Sin comprobante subido
              </span>
            </div>
          </div>
        )}

        {/* Campo de nombre del admin */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Nombre del administrador *
          </label>
          <input
            type="text"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="Ingresa tu nombre completo"
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-brand-pink focus:ring-2 focus:ring-brand-pink/20"
            autoFocus
          />
        </div>

        {/* Checkbox de confirmación */}
        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              Confirmo que he verificado el comprobante y el pago es correcto
            </span>
          </label>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(adminName)}
            disabled={!adminName.trim() || !confirmed}
            className="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            ✅ Confirmar Pago
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 🔔 Sistema de Alertas y Notificaciones

### Alertas en Tiempo Real

1. **Notificación de navegador** (si está permitido):
   - Cuando hay un pago nuevo pendiente
   - Cuando un pago lleva > 24 horas sin atención
   - Cuando un pago lleva > 48 horas sin atención

2. **Sonido opcional**:
   - Para pagos urgentes (> 48h)
   - Configurable en settings

3. **Badge en el menú**:
   - Contador de pagos pendientes
   - Contador de pagos urgentes
   - Actualización en tiempo real

### Cálculo de Urgencia

```typescript
function calculateUrgency(payment: Payment): 'critical' | 'review' | 'new' | 'none' {
  if (payment.status !== 'pending') return 'none';
  
  const hoursPending = calculateHoursPending(payment);
  
  if (hoursPending > 48) return 'critical';
  if (hoursPending > 24) return 'review';
  return 'new';
}

function calculateHoursPending(payment: Payment): number {
  const created = new Date(payment.created_at);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60));
}
```

---

## 📊 Funcionalidades Adicionales

### 1. **Vista de Resumen (Dashboard)**
- Gráfico de pagos por día
- Gráfico de pagos por método
- Tiempo promedio de aprobación
- Tasa de pagos sin comprobante

### 2. **Búsqueda y Filtros Avanzados**
- Búsqueda por referencia
- Búsqueda por comprador (nombre o ID)
- Filtro por rango de fechas
- Filtro por rango de montos
- Filtro por múltiples estados

### 3. **Acciones en Lote**
- Seleccionar múltiples pagos
- Marcar múltiples como pagados
- Exportar seleccionados
- Cancelar múltiples

### 4. **Historial y Auditoría**
- Ver historial de cambios de estado
- Ver quién autorizó cada pago
- Ver notas/comentarios del admin
- Timeline de eventos

---

## ✅ Checklist de Implementación

### Fase 1: Estructura Base
- [ ] Crear componentes base (`PaymentDashboard`, `PaymentSummaryCards`, etc.)
- [ ] Implementar cálculo de urgencia
- [ ] Crear tipos TypeScript para pagos

### Fase 2: Header y Resumen
- [ ] Implementar tarjetas de resumen (KPIs)
- [ ] Implementar banners de alertas
- [ ] Conectar con API para obtener estadísticas

### Fase 3: Filtros Mejorados
- [ ] Implementar filtro por urgencia
- [ ] Implementar filtro por comprobante
- [ ] Implementar búsqueda rápida
- [ ] Implementar filtro por rango de fechas

### Fase 4: Tabla Mejorada
- [ ] Agregar columna de urgencia
- [ ] Agregar columna de comprobante
- [ ] Mejorar columna de comprador
- [ ] Mejorar columna de monto con desglose
- [ ] Agregar indicadores visuales (bordes, badges)

### Fase 5: Botones y Acciones
- [ ] Rediseñar botones principales
- [ ] Implementar modal de confirmación mejorado
- [ ] Implementar modal de detalles
- [ ] Agregar iconos descriptivos
- [ ] Mejorar feedback visual

### Fase 6: Alertas y Notificaciones
- [ ] Implementar sistema de alertas visuales
- [ ] Agregar notificaciones en tiempo real
- [ ] Implementar badges de urgencia
- [ ] Agregar sonidos opcionales (configurable)

### Fase 7: Funcionalidades Adicionales
- [ ] Implementar acciones en lote
- [ ] Agregar exportación
- [ ] Implementar historial/auditoría
- [ ] Agregar gráficos y estadísticas

### Fase 8: Testing y Polish
- [ ] Probar todos los flujos
- [ ] Verificar que las alertas funcionan
- [ ] Optimizar performance
- [ ] Ajustar estilos y UX

---

## 🎨 Paleta de Colores para Alertas

- **🔴 Crítico**: `bg-red-50`, `border-red-600`, `text-red-900`
- **🟡 Revisar**: `bg-amber-50`, `border-amber-500`, `text-amber-900`
- **🟢 Nuevo**: `bg-green-50`, `border-green-500`, `text-green-900`
- **📎 Sin comprobante**: `bg-yellow-50`, `border-yellow-300`, `text-yellow-900`
- **✅ Pagado**: `bg-green-50`, `border-green-200`, `text-green-800`
- **❌ Cancelado**: `bg-gray-50`, `border-gray-200`, `text-gray-700`

---

## 📱 Responsive Design

- **Desktop**: Tabla completa con todas las columnas
- **Tablet**: Tabla con columnas principales, detalles en modal
- **Mobile**: Cards en lugar de tabla, información condensada

---

## 🚀 Resultado Esperado

Al finalizar la reestructuración, el panel de pagos debería:

1. ✅ **Ser más funcional**:
   - Botones grandes y claros
   - Acciones rápidas y fáciles
   - Información organizada

2. ✅ **Ser más claro**:
   - Resumen visual de lo importante
   - Información destacada
   - Flujos intuitivos

3. ✅ **Enviar alertas**:
   - Indicadores visuales de urgencia
   - Banners de alerta
   - Notificaciones en tiempo real
   - Badges y colores que llamen la atención

4. ✅ **Mejorar productividad**:
   - Identificar rápidamente lo que necesita atención
   - Acciones rápidas sin múltiples clicks
   - Información completa en un vistazo

---

## 📝 Notas de Implementación

- Mantener compatibilidad con la API existente
- No romper funcionalidad actual
- Implementar gradualmente (fase por fase)
- Probar cada fase antes de continuar
- Obtener feedback del usuario durante el desarrollo
