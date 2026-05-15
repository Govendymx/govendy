# 🎯 PROMPT: Integración Completa de Paneles con Panel de Administrador

## Objetivo
Conectar todos los paneles de la aplicación (usuario, vendedor, comprador) con el panel de administrador de forma autónoma, reportando todas las operaciones en tiempo real y manteniendo un sistema de tracking y notificaciones centralizado.

---

## 📋 Contexto de la Aplicación

### Paneles Existentes

#### Panel de Administrador (`/app/admin/`)
- **Métricas** (`/admin/metricas`): Ventas, comisiones, payouts, usuarios activos
- **Supervisión** (`/admin/supervision`): Operaciones, pagos, compras, ventas, disputas
- **Pagos** (`/admin/pagos`): Confirmación de pagos offline (transferencias, OXXO, depósitos)
- **Logística** (`/admin/logistica`): Órdenes, etiquetas, tracking, envíos
- **Disputas** (`/admin/disputas`): Resolución de conflictos comprador/vendedor
- **Devoluciones** (`/admin/devoluciones`): Gestión de devoluciones y guías
- **Soporte** (`/admin/soporte`): Conversaciones de ayuda
- **Usuarios** (`/admin/usuarios`): Gestión, suspender, verificar, operaciones
- **Publicaciones** (`/admin/listings`): Listados, moderación
- **Estafeta** (`/admin/estafeta`): Cotizaciones y guías Estafeta
- **Banners** (`/admin/banners`): Contenido destacado
- **Avisos** (`/admin/avisos`): Anuncios
- **Mensajes Flotantes** (`/admin/mensajes-flotantes`): Popups por sección
- **Correo** (`/admin/correo`): Bandeja y envío de correos
- **Configuración** (`/admin/settings`): Comisión, envíos, negocio
- **Negocio** (`/admin/negocio`): Configuración del negocio
- **Plantillas** (`/admin/plantillas`): Plantillas de correo

#### Panel de Usuario (`/app/dashboard/`)
- **Panel Principal** (`/dashboard`): Resumen, KPIs, alertas
- **Perfil** (`/dashboard/perfil`): Información personal
- **Publicaciones** (`/dashboard/listings`): Mis publicaciones
- **Ventas** (`/dashboard/ventas`): Órdenes de venta
- **Compras** (`/dashboard/compras`): Órdenes de compra
- **Pagos** (`/dashboard/pagos`): Gestión de pagos
- **Preguntas** (`/dashboard/preguntas`): Preguntas sin responder
- **Respuestas** (`/dashboard/respuestas`): Respuestas recibidas
- **Favoritos** (`/dashboard/favoritos`): Listings favoritos
- **Reputación** (`/dashboard/reputacion`): Calificaciones
- **Disputas** (`/dashboard/devoluciones`): Disputas del usuario
- **Cupones** (`/dashboard/coupons`): Cupones disponibles
- **Ayuda** (`/dashboard/ayuda`): Soporte

### Sistema de Notificaciones Existente
- **Servicio**: `lib/notifications/service.ts` - Función `notify()`
- **Inserción**: `lib/notifications/insertBestEffort.ts`
- **Notificaciones Admin**: `lib/notifications/admin.ts`
- **Tabla**: `notifications` en Supabase
- **Realtime**: Supabase Realtime subscriptions

### APIs Existentes
- `/api/admin/dashboard/summary` - Resumen del panel admin
- `/api/admin/metrics` - Métricas y estadísticas
- `/api/admin/supervision/operations` - Operaciones para supervisión
- `/api/admin/logistica/orders/list` - Lista de órdenes
- `/api/notifications/list` - Lista de notificaciones
- `/api/alerts/summary` - Resumen de alertas

---

## 🎯 REQUERIMIENTOS DE INTEGRACIÓN

### 1. Sistema de Eventos y Tracking Centralizado

#### Crear Tabla de Eventos de Operaciones
```sql
CREATE TABLE IF NOT EXISTS admin_operation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'order_created', 'payment_received', 'dispute_opened', etc.
  entity_type TEXT NOT NULL, -- 'order', 'payment', 'dispute', 'listing', 'user', etc.
  entity_id TEXT NOT NULL,
  user_id TEXT, -- Usuario que realizó la acción
  admin_id TEXT, -- Admin que procesó (si aplica)
  status TEXT, -- 'pending', 'processing', 'completed', 'failed'
  metadata JSONB DEFAULT '{}', -- Datos adicionales del evento
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  notified_admin BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_admin_events_type ON admin_operation_events(event_type);
CREATE INDEX idx_admin_events_entity ON admin_operation_events(entity_type, entity_id);
CREATE INDEX idx_admin_events_created ON admin_operation_events(created_at DESC);
CREATE INDEX idx_admin_events_notified ON admin_operation_events(notified_admin) WHERE notified_admin = FALSE;
```

#### Crear Función Helper para Registrar Eventos
```typescript
// lib/admin/events.ts
export async function recordAdminEvent(
  admin: SupabaseClient,
  event: {
    event_type: string;
    entity_type: string;
    entity_id: string;
    user_id?: string;
    admin_id?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await admin.from('admin_operation_events').insert([{
    ...event,
    notified_admin: false,
  }]);
}
```

### 2. Notificaciones Automáticas para Administradores

#### Crear Función de Notificación para Admin
```typescript
// lib/notifications/admin.ts (extender existente)
export async function notifyAdmin(
  admin: SupabaseClient,
  payload: {
    title: string;
    body: string;
    type: string;
    data?: Record<string, unknown>;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    link_to?: string;
  }
): Promise<void> {
  // Obtener todos los admins
  const { data: admins } = await admin
    .from('admin_users')
    .select('user_id');
  
  if (!admins || admins.length === 0) return;
  
  // Crear notificación para cada admin
  const notifications = admins.map(adminUser => ({
    user_id: adminUser.user_id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: {
      ...payload.data,
      kind: payload.type,
      priority: payload.priority || 'medium',
      admin_notification: true,
    },
    link_to: payload.link_to,
    is_read: false,
  }));
  
  await admin.from('notifications').insert(notifications);
}
```

### 3. Integración en Todas las Operaciones

#### A. Operaciones de Órdenes

**Cuando se crea una orden** (`/api/checkout/create/route.ts`):
```typescript
// Después de crear la orden
await recordAdminEvent(admin, {
  event_type: 'order_created',
  entity_type: 'order',
  entity_id: orderId,
  user_id: buyerId,
  status: 'pending',
  metadata: {
    order_id: orderId,
    buyer_id: buyerId,
    seller_id: sellerId,
    total: orderTotal,
    items_count: items.length,
  },
});

await notifyAdmin(admin, {
  title: 'Nueva orden creada',
  body: `Orden ${orderId.slice(0, 8)}... por ${formatMoney(orderTotal)}`,
  type: 'admin_order_created',
  priority: 'medium',
  data: { order_id: orderId, buyer_id: buyerId, seller_id: sellerId },
  link_to: `/admin/logistica?order=${orderId}`,
});
```

**Cuando se marca como enviado** (`/api/orders/mark-shipped/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'order_shipped',
  entity_type: 'order',
  entity_id: orderId,
  user_id: sellerId,
  status: 'completed',
  metadata: { tracking_number, shipping_carrier },
});

await notifyAdmin(admin, {
  title: 'Orden enviada',
  body: `Orden ${orderId.slice(0, 8)}... marcada como enviada`,
  type: 'admin_order_shipped',
  priority: 'low',
  data: { order_id: orderId, tracking_number },
  link_to: `/admin/logistica?order=${orderId}`,
});
```

**Cuando se confirma recepción** (`/api/orders/confirm-received/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'order_delivered',
  entity_type: 'order',
  entity_id: orderId,
  user_id: buyerId,
  status: 'completed',
  metadata: { delivered_at: new Date().toISOString() },
});

await notifyAdmin(admin, {
  title: 'Orden entregada',
  body: `Orden ${orderId.slice(0, 8)}... confirmada como entregada`,
  type: 'admin_order_delivered',
  priority: 'medium',
  data: { order_id: orderId },
  link_to: `/admin/supervision?order=${orderId}`,
});
```

#### B. Operaciones de Pagos

**Cuando se recibe pago offline** (`/api/admin/payments/offline/update/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'payment_offline_confirmed',
  entity_type: 'payment',
  entity_id: paymentId,
  admin_id: requesterId,
  status: 'completed',
  metadata: { payment_method, amount },
});

// Ya está en admin, no necesita notificación adicional
```

**Cuando se procesa pago de MercadoPago** (`/api/mercadopago/webhook/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'payment_processed',
  entity_type: 'payment',
  entity_id: paymentId,
  status: 'completed',
  metadata: { payment_method: 'mercadopago', amount, status: paymentStatus },
});

await notifyAdmin(admin, {
  title: 'Pago procesado',
  body: `Pago ${paymentId.slice(0, 8)}... por ${formatMoney(amount)}`,
  type: 'admin_payment_processed',
  priority: 'high',
  data: { payment_id: paymentId, amount },
  link_to: `/admin/pagos?payment=${paymentId}`,
});
```

#### C. Operaciones de Disputas

**Cuando se abre una disputa** (`/api/disputes/open/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'dispute_opened',
  entity_type: 'dispute',
  entity_id: disputeId,
  user_id: userId,
  status: 'pending',
  metadata: { order_id, reason, description },
});

await notifyAdmin(admin, {
  title: '⚠️ Nueva disputa abierta',
  body: `Disputa ${disputeId.slice(0, 8)}... para orden ${orderId.slice(0, 8)}...`,
  type: 'admin_dispute_opened',
  priority: 'urgent',
  data: { dispute_id: disputeId, order_id },
  link_to: `/admin/disputas/${disputeId}`,
});
```

**Cuando se resuelve una disputa** (`/api/admin/disputes/resolve/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'dispute_resolved',
  entity_type: 'dispute',
  entity_id: disputeId,
  admin_id: requesterId,
  status: 'completed',
  metadata: { decision, resolution },
});
```

#### D. Operaciones de Publicaciones

**Cuando se crea una publicación** (`/api/listings/create/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'listing_created',
  entity_type: 'listing',
  entity_id: listingId,
  user_id: sellerId,
  status: 'pending',
  metadata: { title, price, category },
});

await notifyAdmin(admin, {
  title: 'Nueva publicación',
  body: `${title} - ${formatMoney(price)}`,
  type: 'admin_listing_created',
  priority: 'low',
  data: { listing_id: listingId },
  link_to: `/admin/listings?listing=${listingId}`,
});
```

**Cuando se reporta una publicación**:
```typescript
await recordAdminEvent(admin, {
  event_type: 'listing_reported',
  entity_type: 'listing',
  entity_id: listingId,
  user_id: reporterId,
  status: 'pending',
  metadata: { reason, report_details },
});

await notifyAdmin(admin, {
  title: '⚠️ Publicación reportada',
  body: `Publicación ${listingId.slice(0, 8)}... reportada`,
  type: 'admin_listing_reported',
  priority: 'high',
  data: { listing_id: listingId, reason },
  link_to: `/admin/listings?listing=${listingId}`,
});
```

#### E. Operaciones de Usuarios

**Cuando se suspende un usuario** (`/api/admin/users/state/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'user_suspended',
  entity_type: 'user',
  entity_id: userId,
  admin_id: requesterId,
  status: 'completed',
  metadata: { reason, suspension_type },
});
```

**Cuando se verifica un usuario** (`/api/admin/users/verify/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'user_verified',
  entity_type: 'user',
  entity_id: userId,
  admin_id: requesterId,
  status: 'completed',
  metadata: { verification_type },
});
```

#### F. Operaciones de Soporte

**Cuando se crea un mensaje de soporte** (`/api/support/messages/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'support_message_created',
  entity_type: 'support',
  entity_id: conversationId,
  user_id: userId,
  status: 'pending',
  metadata: { message_preview: message.slice(0, 100) },
});

await notifyAdmin(admin, {
  title: 'Nuevo mensaje de soporte',
  body: `Mensaje de ${userName}: ${message.slice(0, 50)}...`,
  type: 'admin_support_message',
  priority: 'medium',
  data: { conversation_id: conversationId },
  link_to: `/admin/soporte?conversation=${conversationId}`,
});
```

#### G. Operaciones de Logística

**Cuando se sube una etiqueta** (`/api/admin/logistica/label/upload/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'shipping_label_uploaded',
  entity_type: 'order',
  entity_id: orderId,
  admin_id: requesterId,
  status: 'completed',
  metadata: { label_url, carrier },
});
```

**Cuando se actualiza tracking** (`/api/admin/logistica/order/update/route.ts`):
```typescript
await recordAdminEvent(admin, {
  event_type: 'tracking_updated',
  entity_type: 'order',
  entity_id: orderId,
  admin_id: requesterId,
  status: 'completed',
  metadata: { tracking_number, carrier },
});
```

### 4. Dashboard de Eventos en Tiempo Real

#### Crear Componente de Eventos en Panel Admin
```typescript
// app/admin/eventos/page.tsx
'use client';

export default function AdminEventosPage() {
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({
    event_type: '',
    entity_type: '',
    status: '',
    date_range: 'today',
  });

  useEffect(() => {
    // Cargar eventos
    const loadEvents = async () => {
      const res = await fetch(`/api/admin/events?${new URLSearchParams(filters)}`);
      const data = await res.json();
      setEvents(data.events || []);
    };
    
    loadEvents();
    const interval = setInterval(loadEvents, 10000); // Actualizar cada 10s
    
    // Suscripción realtime
    const channel = supabase
      .channel('admin-events')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'admin_operation_events',
      }, () => {
        loadEvents();
      })
      .subscribe();
    
    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [filters]);

  return (
    <div>
      <h1>Eventos de Operaciones</h1>
      {/* Filtros */}
      {/* Lista de eventos en tiempo real */}
      {/* Gráficos y estadísticas */}
    </div>
  );
}
```

#### Crear API de Eventos
```typescript
// app/api/admin/events/route.ts
export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
  
  const { searchParams } = new URL(req.url);
  const eventType = searchParams.get('event_type');
  const entityType = searchParams.get('entity_type');
  const status = searchParams.get('status');
  const dateRange = searchParams.get('date_range') || 'today';
  
  let query = admin
    .from('admin_operation_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (eventType) query = query.eq('event_type', eventType);
  if (entityType) query = query.eq('entity_type', entityType);
  if (status) query = query.eq('status', status);
  
  // Filtrar por fecha
  if (dateRange === 'today') {
    query = query.gte('created_at', new Date().toISOString().split('T')[0]);
  } else if (dateRange === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    query = query.gte('created_at', weekAgo.toISOString());
  }
  
  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ ok: true, events: data });
}
```

### 5. Actualización del Dashboard Principal

#### Extender `/api/admin/dashboard/summary`
```typescript
// Agregar al resumen:
{
  recent_events_count: number; // Eventos en últimas 24h
  pending_events_count: number; // Eventos pendientes
  urgent_events_count: number; // Eventos urgentes
  events_by_type: Record<string, number>; // Conteo por tipo
}
```

### 6. Widget de Eventos en Panel Principal

```typescript
// En app/admin/page.tsx agregar sección:
<div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
  <h2 className="text-lg font-bold text-gray-900">Eventos Recientes</h2>
  <div className="mt-4 space-y-2">
    {recentEvents.map(event => (
      <div key={event.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
        <div>
          <div className="text-sm font-semibold">{event.event_type}</div>
          <div className="text-xs text-gray-600">{event.entity_type} - {event.entity_id.slice(0, 8)}...</div>
        </div>
        <Link href={getEventLink(event)} className="text-xs text-brand-pink hover:underline">
          Ver →
        </Link>
      </div>
    ))}
  </div>
</div>
```

### 7. Sistema de Prioridades y Alertas

```typescript
// Definir prioridades por tipo de evento
const EVENT_PRIORITIES: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
  'dispute_opened': 'urgent',
  'payment_failed': 'high',
  'order_created': 'medium',
  'listing_reported': 'high',
  'support_message_created': 'medium',
  'user_suspended': 'high',
  // ... más eventos
};
```

### 8. Integración con Notificaciones Existentes

Asegurar que todas las notificaciones de usuario también generen eventos admin:
```typescript
// En lib/notifications/service.ts, después de insertar notificación:
if (payload.type === 'new_sale' || payload.type === 'sale_paid') {
  await recordAdminEvent(admin, {
    event_type: `admin_${payload.type}`,
    entity_type: 'order',
    entity_id: payload.data?.orderId,
    user_id: payload.user_id,
    metadata: payload.data,
  });
}
```

---

## ✅ Checklist de Implementación

### Fase 1: Infraestructura Base
- [ ] Crear tabla `admin_operation_events` en Supabase
- [ ] Crear función `recordAdminEvent()` en `lib/admin/events.ts`
- [ ] Crear función `notifyAdmin()` en `lib/notifications/admin.ts`
- [ ] Crear API `/api/admin/events` para listar eventos

### Fase 2: Integración en Operaciones Críticas
- [ ] Integrar en creación de órdenes
- [ ] Integrar en pagos (MercadoPago y offline)
- [ ] Integrar en envíos y logística
- [ ] Integrar en disputas
- [ ] Integrar en soporte

### Fase 3: Panel de Eventos
- [ ] Crear página `/admin/eventos`
- [ ] Implementar filtros y búsqueda
- [ ] Implementar actualización en tiempo real
- [ ] Agregar gráficos y estadísticas

### Fase 4: Dashboard Mejorado
- [ ] Actualizar `/api/admin/dashboard/summary` con eventos
- [ ] Agregar widget de eventos recientes en `/admin`
- [ ] Agregar contadores de eventos pendientes/urgentes

### Fase 5: Notificaciones Admin
- [ ] Configurar notificaciones para todos los admins
- [ ] Implementar sistema de prioridades
- [ ] Agregar enlaces directos a operaciones desde notificaciones

### Fase 6: Integración Completa
- [ ] Integrar en publicaciones
- [ ] Integrar en usuarios
- [ ] Integrar en devoluciones
- [ ] Integrar en Estafeta
- [ ] Integrar en todas las operaciones restantes

---

## 🎨 Mejoras Adicionales Recomendadas

1. **Gráficos de Actividad**: Mostrar gráficos de eventos por hora/día en el dashboard
2. **Exportación**: Permitir exportar eventos a CSV/Excel
3. **Filtros Avanzados**: Filtros por usuario, rango de fechas, múltiples tipos
4. **Búsqueda**: Búsqueda full-text en eventos
5. **Agrupación**: Agrupar eventos similares para reducir ruido
6. **Alertas Configurables**: Permitir a admins configurar qué eventos quieren recibir
7. **Historial Completo**: Mantener historial completo de todas las operaciones
8. **Analytics**: Dashboard de analytics basado en eventos

---

## 📝 Notas de Implementación

- **Performance**: Usar índices en la tabla de eventos para consultas rápidas
- **Escalabilidad**: Considerar archivar eventos antiguos (>30 días) a una tabla separada
- **Privacidad**: No registrar datos sensibles (contraseñas, tokens) en metadata
- **Error Handling**: Todos los eventos deben tener manejo de errores para no interrumpir operaciones principales
- **Testing**: Probar que los eventos se registran correctamente sin afectar el flujo normal

---

## 🔗 Enlaces de Referencia

- Sistema de notificaciones: `lib/notifications/service.ts`
- Panel admin principal: `app/admin/page.tsx`
- API de supervisión: `app/api/admin/supervision/operations/route.ts`
- Dashboard summary: `app/api/admin/dashboard/summary/route.ts`

---

**Este prompt debe implementarse de forma incremental, comenzando con las operaciones más críticas (órdenes, pagos, disputas) y luego expandiendo a todas las demás operaciones.**
