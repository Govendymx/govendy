# Prompt: Reestructurar Todos los Paneles de Administrador - Integración Completa

## 🎯 Objetivo

Reestructurar **TODOS** los paneles de administrador para que:
1. **Trabajen en conjunto** con pagos y operaciones de la app
2. **Sean más funcionales** con acciones rápidas y flujos integrados
3. **Compartan información** entre paneles de forma inteligente
4. **Tengan navegación contextual** entre operaciones relacionadas
5. **Muestren alertas unificadas** de lo que necesita atención
6. **Permitan acciones rápidas** desde cualquier panel

---

## 📊 Análisis de Paneles Actuales

### Paneles Identificados

#### **Dashboard y Análisis**
- `/admin` - Dashboard principal
- `/admin/metricas` - Métricas y estadísticas
- `/admin/supervision` - Supervisión de operaciones

#### **Operaciones Core**
- `/admin/pagos` - Pagos offline
- `/admin/logistica` - Logística y envíos
- `/admin/disputas` - Disputas
- `/admin/devoluciones` - Devoluciones
- `/admin/soporte` - Soporte al cliente

#### **Contenido y Usuarios**
- `/admin/usuarios` - Gestión de usuarios
- `/admin/listings` - Publicaciones/productos
- `/admin/estafeta` - Tienda Estafeta

#### **Marketing y Comunicación**
- `/admin/banners` - Banners
- `/admin/avisos` - Avisos
- `/admin/mensajes-flotantes` - Mensajes flotantes
- `/admin/publicidad` - Publicidad
- `/admin/correo` - Correo

#### **Configuración**
- `/admin/plantillas` - Plantillas
- `/admin/negocio` - Configuración de negocio
- `/admin/settings` - Configuración general

### Problemas Identificados

1. ❌ **Paneles aislados**: No comparten información entre sí
2. ❌ **Navegación fragmentada**: Difícil moverse entre operaciones relacionadas
3. ❌ **Datos duplicados**: Cada panel carga sus propios datos
4. ❌ **Sin contexto**: No se ve la relación entre pagos, órdenes, disputas, etc.
5. ❌ **Acciones desconectadas**: Cambios en un panel no se reflejan en otros
6. ❌ **Alertas dispersas**: Cada panel tiene sus propias alertas sin unificación
7. ❌ **Sin flujos de trabajo**: No hay guía para completar tareas relacionadas

---

## 🏗️ Arquitectura Propuesta

### 1. **Sistema de Estado Compartido (Context API)**

**Objetivo**: Compartir datos entre paneles sin recargar

```typescript
// lib/admin/AdminContext.tsx
interface AdminContextType {
  // Estado global compartido
  orders: Order[];
  payments: Payment[];
  disputes: Dispute[];
  users: User[];
  listings: Listing[];
  
  // Métricas globales
  metrics: AdminMetrics;
  
  // Estado de carga
  loading: {
    orders: boolean;
    payments: boolean;
    disputes: boolean;
  };
  
  // Funciones de actualización
  refreshOrders: () => Promise<void>;
  refreshPayments: () => Promise<void>;
  refreshDisputes: () => Promise<void>;
  
  // Funciones de acción
  markPaymentAsPaid: (paymentId: string, adminName: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
  resolveDispute: (disputeId: string, resolution: string) => Promise<void>;
  
  // Navegación contextual
  navigateToRelated: (type: 'order' | 'payment' | 'dispute', id: string) => void;
}
```

### 2. **Sistema de Navegación Contextual**

**Objetivo**: Navegar fácilmente entre operaciones relacionadas

```typescript
// components/admin/ContextualNavigation.tsx
interface RelatedItems {
  order?: Order;
  payment?: Payment;
  dispute?: Dispute;
  buyer?: User;
  seller?: User;
  listing?: Listing;
}

function ContextualNavigation({ currentItem, type }: Props) {
  // Mostrar links a operaciones relacionadas
  // Ejemplo: Desde un pago, mostrar link a la orden, al comprador, al vendedor
}
```

### 3. **Sistema de Alertas Unificado**

**Objetivo**: Mostrar todas las alertas en un solo lugar

```typescript
// lib/admin/alerts.ts
interface AdminAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'payment' | 'order' | 'dispute' | 'support' | 'logistics';
  title: string;
  description: string;
  actionUrl: string;
  actionLabel: string;
  relatedIds: {
    orderId?: string;
    paymentId?: string;
    disputeId?: string;
    userId?: string;
  };
  createdAt: string;
  priority: number; // 1-10, mayor = más urgente
}

// Función para calcular alertas desde todos los paneles
async function calculateAllAlerts(): Promise<AdminAlert[]> {
  // Combinar alertas de:
  // - Pagos pendientes > 48h
  // - Órdenes sin guía
  // - Disputas sin resolver
  // - Soporte sin responder
  // - etc.
}
```

### 4. **Componente de Vista Unificada de Operación**

**Objetivo**: Ver toda la información de una operación en un solo lugar

```typescript
// components/admin/OperationView.tsx
// Muestra: Orden + Pago + Disputa + Usuarios + Timeline + Acciones
function OperationView({ orderId }: { orderId: string }) {
  // Cargar todos los datos relacionados
  // Mostrar en tabs o secciones
  // Permitir acciones rápidas
}
```

---

## 🔄 Flujos de Trabajo Integrados

### Flujo 1: Procesar Pago Offline

**Estado Actual**: 
- Ir a `/admin/pagos`
- Buscar el pago
- Marcar como pagado
- Ir a `/admin/logistica` para ver la orden
- Subir guía si es necesario

**Estado Propuesto**:
1. **Alerta en dashboard**: "5 pagos pendientes > 48h"
2. **Click en alerta** → Abre vista unificada del pago
3. **Vista muestra**:
   - Detalles del pago
   - Orden relacionada
   - Comprobante (si existe)
   - Información del comprador
   - Información del vendedor
   - Timeline de eventos
4. **Acciones rápidas**:
   - ✅ Marcar como pagado
   - 📄 Ver hoja de pago
   - 📎 Ver comprobante
   - 📦 Ver orden en logística
   - 👤 Ver perfil del comprador
   - 💬 Enviar mensaje al comprador
5. **Después de marcar como pagado**:
   - Automáticamente muestra la orden relacionada
   - Sugiere subir guía si la orden está pagada
   - Muestra botón "Ir a logística" para subir guía

### Flujo 2: Gestionar Orden Completa

**Estado Actual**: 
- Ver orden en `/admin/logistica`
- Si necesita pago, ir a `/admin/pagos`
- Si hay disputa, ir a `/admin/disputas`
- Si necesita soporte, ir a `/admin/soporte`

**Estado Propuesto**:
1. **Vista unificada de orden** muestra:
   - Estado de la orden
   - Estado del pago (con link directo)
   - Disputa si existe (con link directo)
   - Tickets de soporte relacionados
   - Timeline completo
2. **Acciones contextuales**:
   - Si pago pendiente → Botón "Ver pago" → Abre modal o navega
   - Si hay disputa → Botón "Resolver disputa" → Abre modal o navega
   - Si necesita guía → Botón "Subir guía" → Modal de subida
   - Si necesita tracking → Botón "Agregar tracking" → Modal

### Flujo 3: Resolver Disputa

**Estado Actual**: 
- Ir a `/admin/disputas`
- Ver disputa
- Ir a `/admin/pagos` para ver pago
- Ir a `/admin/logistica` para ver orden
- Resolver

**Estado Propuesto**:
1. **Vista unificada de disputa** muestra:
   - Detalles de la disputa
   - Orden relacionada (con estado actual)
   - Pago relacionado (con estado actual)
   - Mensajes del comprador
   - Mensajes del vendedor
   - Historial de la orden
   - Evidencia (fotos, etc.)
2. **Acciones rápidas**:
   - Resolver a favor del comprador
   - Resolver a favor del vendedor
   - Ver orden completa
   - Ver pago completo
   - Contactar comprador
   - Contactar vendedor
   - Agregar nota interna

---

## 🎨 Componentes Propuestos

### 1. **AdminLayout Mejorado**

```tsx
// app/admin/layout.tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminTopMenu />
      <AdminAlertsBar /> {/* Nuevo: Barra de alertas unificada */}
      <AdminQuickActions /> {/* Nuevo: Acciones rápidas flotantes */}
      <div className="container mx-auto px-4 py-6">
        {children}
      </div>
      <AdminContextualSidebar /> {/* Nuevo: Sidebar con operaciones relacionadas */}
    </AdminProvider>
  );
}
```

### 2. **Barra de Alertas Unificada**

```tsx
// components/admin/AdminAlertsBar.tsx
function AdminAlertsBar() {
  const { alerts } = useAdminContext();
  
  const criticalAlerts = alerts.filter(a => a.type === 'critical');
  const warningAlerts = alerts.filter(a => a.type === 'warning');
  
  return (
    <div className="sticky top-[60px] z-50 border-b bg-white/95 backdrop-blur">
      {criticalAlerts.length > 0 && (
        <div className="bg-red-50 border-b-2 border-red-300 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              <span className="font-bold text-red-900">
                {criticalAlerts.length} alerta(s) crítica(s) requiere(n) atención inmediata
              </span>
            </div>
            <Link
              href="/admin/alerts?type=critical"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
            >
              Ver todas →
            </Link>
          </div>
        </div>
      )}
      
      {warningAlerts.length > 0 && criticalAlerts.length === 0 && (
        <div className="bg-amber-50 border-b-2 border-amber-300 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <span className="font-semibold text-amber-900">
                {warningAlerts.length} alerta(s) que requieren revisión
              </span>
            </div>
            <Link
              href="/admin/alerts?type=warning"
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
            >
              Ver todas →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3. **Vista Unificada de Operación**

```tsx
// components/admin/OperationView.tsx
function OperationView({ orderId, paymentId, disputeId }: Props) {
  const { orders, payments, disputes, navigateToRelated } = useAdminContext();
  
  // Cargar todos los datos relacionados
  const order = orders.find(o => o.id === orderId);
  const payment = payments.find(p => p.id === paymentId);
  const dispute = disputes.find(d => d.id === disputeId);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Columna principal: Información principal */}
      <div className="lg:col-span-2 space-y-6">
        {/* Tabs para diferentes vistas */}
        <Tabs>
          <Tab label="Resumen" icon="📊">
            <OperationSummary order={order} payment={payment} dispute={dispute} />
          </Tab>
          <Tab label="Timeline" icon="⏱️">
            <OperationTimeline orderId={orderId} />
          </Tab>
          <Tab label="Mensajes" icon="💬">
            <OperationMessages orderId={orderId} />
          </Tab>
          <Tab label="Evidencia" icon="📎">
            <OperationEvidence orderId={orderId} disputeId={disputeId} />
          </Tab>
        </Tabs>
      </div>
      
      {/* Sidebar: Acciones rápidas y operaciones relacionadas */}
      <div className="space-y-6">
        <QuickActions
          order={order}
          payment={payment}
          dispute={dispute}
          onAction={handleAction}
        />
        
        <RelatedOperations
          orderId={orderId}
          paymentId={paymentId}
          disputeId={disputeId}
          onNavigate={navigateToRelated}
        />
      </div>
    </div>
  );
}
```

### 4. **Navegación Contextual**

```tsx
// components/admin/ContextualNavigation.tsx
function ContextualNavigation({ currentItem, type }: Props) {
  const related = useMemo(() => {
    if (type === 'payment') {
      return {
        order: findOrderByPaymentId(currentItem.id),
        buyer: findUserById(currentItem.buyer_id),
        seller: findSellerByPaymentId(currentItem.id),
      };
    }
    if (type === 'order') {
      return {
        payment: findPaymentByOrderId(currentItem.id),
        dispute: findDisputeByOrderId(currentItem.id),
        buyer: findUserById(currentItem.buyer_id),
        seller: findUserById(currentItem.seller_id),
        listing: findListingByOrderId(currentItem.id),
      };
    }
    // ... más tipos
  }, [currentItem, type]);
  
  return (
    <div className="rounded-2xl bg-gray-50 p-4 border border-gray-200">
      <div className="text-xs font-semibold text-gray-600 mb-3">Operaciones relacionadas</div>
      <div className="space-y-2">
        {related.order && (
          <Link
            href={`/admin/operations?orderId=${related.order.id}`}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 hover:bg-gray-50 border border-gray-200"
          >
            <div className="flex items-center gap-2">
              <span>📦</span>
              <span className="text-sm font-semibold">Orden #{related.order.id.slice(0, 8)}</span>
            </div>
            <span className="text-xs text-gray-500">→</span>
          </Link>
        )}
        {related.payment && (
          <Link
            href={`/admin/operations?paymentId=${related.payment.id}`}
            className="flex items-center justify-between rounded-lg bg-white px-3 py-2 hover:bg-gray-50 border border-gray-200"
          >
            <div className="flex items-center gap-2">
              <span>💰</span>
              <span className="text-sm font-semibold">Pago {related.payment.reference_code}</span>
            </div>
            <span className="text-xs text-gray-500">→</span>
          </Link>
        )}
        {/* ... más items relacionados ... */}
      </div>
    </div>
  );
}
```

### 5. **Acciones Rápidas Flotantes**

```tsx
// components/admin/AdminQuickActions.tsx
function AdminQuickActions() {
  const { alerts, metrics } = useAdminContext();
  
  const quickActions = [
    {
      label: 'Marcar pago',
      icon: '✅',
      count: metrics.payments_offline_pending,
      onClick: () => navigate('/admin/pagos?filter=pending'),
      color: 'green',
    },
    {
      label: 'Subir guía',
      icon: '📦',
      count: metrics.orders_paid_pending_ship,
      onClick: () => navigate('/admin/logistica?filter=paid'),
      color: 'blue',
    },
    {
      label: 'Resolver disputa',
      icon: '⚖️',
      count: metrics.disputes_open,
      onClick: () => navigate('/admin/disputas?filter=open'),
      color: 'red',
    },
    {
      label: 'Responder soporte',
      icon: '💬',
      count: metrics.support_unread_estimate,
      onClick: () => navigate('/admin/soporte?filter=unread'),
      color: 'purple',
    },
  ];
  
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <div className="flex flex-col gap-3">
        {quickActions
          .filter(a => a.count > 0)
          .map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={`
                flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg
                bg-${action.color}-600 text-white font-bold
                hover:bg-${action.color}-700 transition
              `}
            >
              <span className="text-2xl">{action.icon}</span>
              <div className="text-left">
                <div className="text-sm">{action.label}</div>
                <div className="text-xs opacity-90">{action.count} pendiente(s)</div>
              </div>
              <div className="ml-2 rounded-full bg-white/20 px-2 py-1 text-xs font-bold">
                {action.count}
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
```

### 6. **Panel de Pagos Mejorado con Integración**

```tsx
// app/admin/pagos/page.tsx (mejorado)
export default function AdminPagosPage() {
  const { payments, refreshPayments, navigateToRelated } = useAdminContext();
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  
  return (
    <div className="space-y-6">
      {/* Header con resumen */}
      <PaymentSummaryCards payments={payments} />
      
      {/* Alertas específicas de pagos */}
      <PaymentAlerts payments={payments} />
      
      {/* Tabla de pagos */}
      <PaymentTable
        payments={payments}
        onSelectPayment={setSelectedPayment}
        onAction={handlePaymentAction}
      />
      
      {/* Modal/Vista de pago con operaciones relacionadas */}
      {selectedPayment && (
        <OperationView
          paymentId={selectedPayment}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  );
}
```

### 7. **Panel de Logística Mejorado con Integración**

```tsx
// app/admin/logistica/page.tsx (mejorado)
export default function AdminLogisticaPage() {
  const { orders, payments, refreshOrders, navigateToRelated } = useAdminContext();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  
  return (
    <div className="space-y-6">
      {/* Header con resumen */}
      <LogisticsSummaryCards orders={orders} />
      
      {/* Alertas específicas de logística */}
      <LogisticsAlerts orders={orders} />
      
      {/* Tabla de órdenes */}
      <OrdersTable
        orders={orders}
        payments={payments} // Mostrar estado de pago en cada orden
        onSelectOrder={setSelectedOrder}
        onAction={handleOrderAction}
      />
      
      {/* Modal/Vista de orden con operaciones relacionadas */}
      {selectedOrder && (
        <OperationView
          orderId={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}
```

---

## 🔗 Integraciones Propuestas

### 1. **Integración Pagos ↔ Logística**

**En Panel de Pagos**:
- Mostrar estado de la orden relacionada
- Botón "Ver orden" que abre modal o navega
- Si la orden está pagada, sugerir "Ir a logística para subir guía"

**En Panel de Logística**:
- Mostrar estado del pago relacionado
- Badge de urgencia si el pago está pendiente > 48h
- Botón "Ver pago" que abre modal o navega
- Si el pago está pendiente, mostrar alerta

### 2. **Integración Órdenes ↔ Disputas**

**En Panel de Logística**:
- Mostrar si hay disputa abierta
- Badge rojo si hay disputa
- Botón "Resolver disputa" que abre modal o navega

**En Panel de Disputas**:
- Mostrar estado de la orden relacionada
- Mostrar estado del pago relacionado
- Timeline de la orden
- Botones para ver orden y pago completos

### 3. **Integración Usuarios ↔ Operaciones**

**En Panel de Usuarios**:
- Mostrar resumen de operaciones del usuario:
  - Órdenes como comprador
  - Órdenes como vendedor
  - Pagos realizados
  - Disputas involucradas
- Links rápidos a cada operación

**En Cualquier Panel**:
- Click en nombre de usuario → Abre modal con perfil completo
- Mostrar historial de operaciones del usuario
- Acciones rápidas: Contactar, Suspender, etc.

### 4. **Integración Dashboard ↔ Todos los Paneles**

**En Dashboard**:
- KPIs clickeables que navegan al panel correspondiente
- Filtros pre-aplicados según el KPI
- Ejemplo: Click en "5 pagos pendientes" → `/admin/pagos?filter=pending&urgent=true`

**En Todos los Paneles**:
- Botón "Volver al dashboard" con contexto
- Breadcrumbs que muestran la ruta
- Botón "Ver en dashboard" para operaciones importantes

---

## 📱 Nueva Página: Vista Unificada de Operaciones

### `/admin/operations`

**Propósito**: Ver y gestionar una operación completa (orden + pago + disputa + usuarios) en un solo lugar

**URLs**:
- `/admin/operations?orderId=xxx`
- `/admin/operations?paymentId=xxx`
- `/admin/operations?disputeId=xxx`

**Características**:
- Carga automática de todas las operaciones relacionadas
- Tabs para diferentes vistas (Resumen, Timeline, Mensajes, Evidencia)
- Acciones rápidas en sidebar
- Navegación contextual a operaciones relacionadas
- Actualización en tiempo real
- Historial completo de cambios

---

## 🎯 Sistema de Priorización y Alertas

### Cálculo de Prioridad

```typescript
function calculatePriority(item: Payment | Order | Dispute): number {
  let priority = 0;
  
  // Factores de prioridad para pagos
  if (item.type === 'payment') {
    const hoursPending = calculateHoursPending(item);
    if (hoursPending > 48) priority += 10;
    else if (hoursPending > 24) priority += 5;
    
    if (!item.payment_proof_url) priority += 3;
    if (item.amount > 10000) priority += 2; // Montos altos
  }
  
  // Factores de prioridad para órdenes
  if (item.type === 'order') {
    if (item.status === 'paid' && !item.shipping_label_url) priority += 8;
    if (item.status === 'shipped' && !item.tracking_number) priority += 5;
    if (item.delivery_deadline && isPastDeadline(item.delivery_deadline)) priority += 10;
  }
  
  // Factores de prioridad para disputas
  if (item.type === 'dispute') {
    if (item.status === 'open') priority += 7;
    const hoursOpen = calculateHoursOpen(item);
    if (hoursOpen > 72) priority += 5;
  }
  
  return Math.min(priority, 10); // Máximo 10
}
```

### Agrupación de Alertas

```typescript
interface AlertGroup {
  category: string;
  items: AdminAlert[];
  totalPriority: number;
  actionUrl: string;
}

function groupAlerts(alerts: AdminAlert[]): AlertGroup[] {
  // Agrupar por categoría
  // Calcular prioridad total
  // Ordenar por prioridad
  // Retornar grupos
}
```

---

## 🔄 Actualización en Tiempo Real

### Supabase Realtime Integration

```typescript
// lib/admin/realtime.ts
export function setupAdminRealtime(context: AdminContextType) {
  const supabase = createClient(...);
  
  // Escuchar cambios en órdenes
  supabase
    .channel('admin-orders')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders',
    }, (payload) => {
      console.log('Orden actualizada:', payload);
      context.refreshOrders();
    })
    .subscribe();
  
  // Escuchar cambios en pagos
  supabase
    .channel('admin-payments')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'checkout_sessions',
    }, (payload) => {
      console.log('Pago actualizado:', payload);
      context.refreshPayments();
    })
    .subscribe();
  
  // Escuchar cambios en disputas
  supabase
    .channel('admin-disputes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'disputes',
    }, (payload) => {
      console.log('Disputa actualizada:', payload);
      context.refreshDisputes();
    })
    .subscribe();
}
```

---

## 📊 Mejoras en Cada Panel

### Panel de Pagos (`/admin/pagos`)

**Mejoras**:
- ✅ Integración con órdenes: Mostrar estado de orden relacionada
- ✅ Integración con usuarios: Mostrar información del comprador
- ✅ Alertas de urgencia: Pagos > 48h destacados
- ✅ Acciones rápidas: Marcar pagado desde lista
- ✅ Vista unificada: Click en pago → Abre vista completa con orden relacionada
- ✅ Filtros mejorados: Por urgencia, por método, por comprobante
- ✅ Búsqueda: Por referencia, comprador, monto

### Panel de Logística (`/admin/logistica`)

**Mejoras**:
- ✅ Integración con pagos: Mostrar estado de pago en cada orden
- ✅ Integración con disputas: Mostrar si hay disputa abierta
- ✅ Alertas contextuales: Órdenes pagadas sin guía, órdenes sin tracking
- ✅ Acciones rápidas: Subir guía, agregar tracking desde lista
- ✅ Vista unificada: Click en orden → Abre vista completa
- ✅ Filtros mejorados: Por estado de pago, por urgencia, por vendedor
- ✅ Búsqueda: Por ID, comprador, vendedor, producto

### Panel de Disputas (`/admin/disputas`)

**Mejoras**:
- ✅ Integración con órdenes: Mostrar estado de orden relacionada
- ✅ Integración con pagos: Mostrar estado de pago relacionado
- ✅ Vista unificada: Click en disputa → Abre vista completa
- ✅ Acciones rápidas: Resolver desde lista
- ✅ Timeline: Ver historial completo de la orden
- ✅ Evidencia: Ver fotos, mensajes, etc.

### Panel de Usuarios (`/admin/usuarios`)

**Mejoras**:
- ✅ Resumen de operaciones: Ver todas las operaciones del usuario
- ✅ Links rápidos: A órdenes, pagos, disputas del usuario
- ✅ Acciones contextuales: Contactar, suspender, verificar
- ✅ Historial completo: Timeline de todas las operaciones

### Dashboard (`/admin`)

**Mejoras**:
- ✅ KPIs clickeables: Navegar al panel con filtros aplicados
- ✅ Alertas unificadas: Ver todas las alertas en un lugar
- ✅ Acciones rápidas: Botones para tareas comunes
- ✅ Gráficos interactivos: Click para filtrar
- ✅ Vista de operaciones recientes: Timeline unificado

---

## ✅ Checklist de Implementación

### Fase 1: Infraestructura Base
- [ ] Crear `AdminContext` con estado compartido
- [ ] Crear `AdminProvider` para envolver paneles
- [ ] Implementar funciones de actualización compartidas
- [ ] Configurar Realtime para actualizaciones automáticas

### Fase 2: Sistema de Alertas
- [ ] Crear función `calculateAllAlerts()`
- [ ] Implementar `AdminAlertsBar` component
- [ ] Crear página `/admin/alerts` para ver todas las alertas
- [ ] Integrar alertas en cada panel

### Fase 3: Navegación Contextual
- [ ] Crear `ContextualNavigation` component
- [ ] Implementar función `navigateToRelated()`
- [ ] Agregar navegación contextual en cada panel
- [ ] Crear breadcrumbs mejorados

### Fase 4: Vista Unificada de Operaciones
- [ ] Crear página `/admin/operations`
- [ ] Implementar `OperationView` component
- [ ] Crear tabs (Resumen, Timeline, Mensajes, Evidencia)
- [ ] Implementar acciones rápidas en sidebar

### Fase 5: Integración Pagos ↔ Logística
- [ ] Mostrar estado de orden en panel de pagos
- [ ] Mostrar estado de pago en panel de logística
- [ ] Implementar navegación bidireccional
- [ ] Agregar acciones contextuales

### Fase 6: Integración con Disputas
- [ ] Mostrar disputas en panel de logística
- [ ] Mostrar orden y pago en panel de disputas
- [ ] Implementar navegación bidireccional
- [ ] Agregar acciones contextuales

### Fase 7: Integración con Usuarios
- [ ] Mostrar resumen de operaciones en perfil de usuario
- [ ] Agregar links rápidos a operaciones
- [ ] Implementar modal de perfil desde cualquier panel
- [ ] Agregar acciones contextuales

### Fase 8: Mejoras en Dashboard
- [ ] Hacer KPIs clickeables con filtros
- [ ] Agregar alertas unificadas
- [ ] Implementar acciones rápidas
- [ ] Agregar gráficos interactivos

### Fase 9: Acciones Rápidas Flotantes
- [ ] Crear `AdminQuickActions` component
- [ ] Implementar botones flotantes
- [ ] Agregar contadores de pendientes
- [ ] Integrar con navegación

### Fase 10: Testing y Polish
- [ ] Probar todos los flujos integrados
- [ ] Verificar actualizaciones en tiempo real
- [ ] Optimizar performance
- [ ] Ajustar UX/UI

---

## 🎨 Diseño Visual Unificado

### Paleta de Colores Consistente

- **Crítico/Urgente**: Rojo (`bg-red-600`, `text-red-900`)
- **Atención/Revisar**: Amarillo (`bg-amber-500`, `text-amber-900`)
- **Info/Normal**: Azul (`bg-blue-500`, `text-blue-900`)
- **Éxito/Completado**: Verde (`bg-green-600`, `text-green-900`)
- **Neutro**: Gris (`bg-gray-100`, `text-gray-900`)

### Componentes Reutilizables

- `StatusBadge` - Badge de estado consistente
- `UrgencyBadge` - Badge de urgencia
- `ActionButton` - Botón de acción consistente
- `SummaryCard` - Tarjeta de resumen
- `AlertBanner` - Banner de alerta
- `ContextualLink` - Link con contexto
- `OperationCard` - Card de operación

---

## 🚀 Resultado Esperado

Al finalizar la reestructuración:

1. ✅ **Paneles integrados**: Todos los paneles comparten información y estado
2. ✅ **Navegación fluida**: Fácil moverse entre operaciones relacionadas
3. ✅ **Alertas unificadas**: Todas las alertas en un solo lugar, priorizadas
4. ✅ **Acciones rápidas**: Acciones comunes disponibles desde cualquier panel
5. ✅ **Vista unificada**: Ver toda la información de una operación en un lugar
6. ✅ **Flujos de trabajo**: Guías claras para completar tareas relacionadas
7. ✅ **Tiempo real**: Actualizaciones automáticas sin recargar
8. ✅ **Mejor productividad**: Menos clicks, más eficiencia

---

## 📝 Notas de Implementación

- Implementar gradualmente, panel por panel
- Mantener compatibilidad con código existente
- Probar cada integración antes de continuar
- Documentar cambios en cada fase
- Obtener feedback del usuario durante el desarrollo
- Priorizar integraciones más usadas primero (Pagos ↔ Logística)

---

## 🔗 Archivos a Crear/Modificar

### Nuevos Archivos
- `lib/admin/AdminContext.tsx`
- `lib/admin/AdminProvider.tsx`
- `lib/admin/alerts.ts`
- `lib/admin/realtime.ts`
- `components/admin/AdminAlertsBar.tsx`
- `components/admin/AdminQuickActions.tsx`
- `components/admin/ContextualNavigation.tsx`
- `components/admin/OperationView.tsx`
- `components/admin/OperationSummary.tsx`
- `components/admin/OperationTimeline.tsx`
- `app/admin/operations/page.tsx`
- `app/admin/alerts/page.tsx`

### Archivos a Modificar
- `app/admin/layout.tsx` - Agregar providers y componentes globales
- `app/admin/pagos/page.tsx` - Integrar con contexto y navegación
- `app/admin/logistica/page.tsx` - Integrar con contexto y navegación
- `app/admin/disputas/page.tsx` - Integrar con contexto y navegación
- `app/admin/page.tsx` - Mejorar dashboard con integraciones
- `components/admin/AdminTopMenu.tsx` - Agregar indicadores de alertas
- Todos los demás paneles - Integrar con contexto

---

## 🎯 Priorización de Implementación

1. **Alta Prioridad**:
   - AdminContext y AdminProvider
   - Integración Pagos ↔ Logística
   - Sistema de alertas básico
   - Vista unificada de operaciones

2. **Media Prioridad**:
   - Integración con Disputas
   - Navegación contextual
   - Acciones rápidas flotantes
   - Mejoras en Dashboard

3. **Baja Prioridad**:
   - Integración con Usuarios
   - Gráficos interactivos
   - Optimizaciones avanzadas
   - Features adicionales
