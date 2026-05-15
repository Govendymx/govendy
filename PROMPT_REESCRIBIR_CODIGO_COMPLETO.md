# Prompt: Reescribir Todo el Código desde Cero - Arquitectura Lógica y Racional

## 🎯 Objetivo

Reescribir completamente la aplicación Pocket Marketplace desde cero con una arquitectura limpia, lógica, escalable y mantenible. El código debe seguir principios SOLID, patrones de diseño apropiados, y estar organizado de manera intuitiva.

---

## 📋 Contexto del Proyecto

### Aplicación: Pocket Marketplace (C2C)
- **Tipo**: Marketplace de consumidor a consumidor (estilo Mercado Libre / GoTrendier)
- **Stack**: Next.js 14 (App Router), TypeScript, Supabase, Tailwind CSS
- **Funcionalidades principales**:
  - Publicación y venta de productos
  - Compra y checkout (MercadoPago + offline)
  - Sistema de logística y envíos
  - Panel de administración
  - Sistema de notificaciones
  - Disputas y devoluciones
  - Reputación y calificaciones
  - Chat y soporte

---

## 🏗️ Principios de Arquitectura

### 1. **Separación de Responsabilidades (SoC)**
- Cada módulo tiene una responsabilidad única y clara
- Frontend solo maneja UI/UX
- Backend solo maneja lógica de negocio y datos
- Servicios externos están abstraídos

### 2. **Principios SOLID**
- **S**ingle Responsibility: Cada clase/función hace una cosa
- **O**pen/Closed: Abierto a extensión, cerrado a modificación
- **L**iskov Substitution: Interfaces intercambiables
- **I**nterface Segregation: Interfaces específicas, no genéricas
- **D**ependency Inversion: Depender de abstracciones, no implementaciones

### 3. **DRY (Don't Repeat Yourself)**
- Código reutilizable en funciones/componentes
- Lógica compartida en servicios/utilities
- Evitar duplicación de código

### 4. **KISS (Keep It Simple, Stupid)**
- Soluciones simples sobre complejas
- Código legible y fácil de entender
- Evitar sobre-ingeniería

### 5. **YAGNI (You Aren't Gonna Need It)**
- Solo implementar lo necesario
- No anticipar funcionalidades futuras
- Código mínimo y funcional

---

## 📁 Estructura de Carpetas Propuesta

```
pocket-app/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Grupo de rutas de autenticación
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (public)/                 # Rutas públicas
│   │   ├── page.tsx             # Home
│   │   ├── explorar/
│   │   ├── listings/
│   │   └── perfil/[id]/
│   ├── (dashboard)/              # Rutas protegidas (requieren auth)
│   │   ├── dashboard/
│   │   │   ├── compras/
│   │   │   ├── ventas/
│   │   │   ├── perfil/
│   │   │   └── ...
│   │   └── sell/                 # Publicar producto
│   ├── (admin)/                  # Rutas de administración
│   │   └── admin/
│   │       ├── supervision/
│   │       ├── logistica/
│   │       ├── pagos/
│   │       └── ...
│   └── api/                      # API Routes
│       ├── auth/                 # Autenticación
│       ├── listings/             # Productos
│       ├── orders/               # Órdenes
│       ├── payments/             # Pagos
│       ├── logistics/            # Logística
│       ├── notifications/        # Notificaciones
│       └── admin/                # Admin APIs
│
├── components/                    # Componentes React reutilizables
│   ├── ui/                       # Componentes base (botones, inputs, etc.)
│   ├── layout/                   # Layout components (Header, Footer, etc.)
│   ├── features/                 # Componentes por funcionalidad
│   │   ├── listings/             # Componentes de productos
│   │   ├── orders/               # Componentes de órdenes
│   │   ├── payments/             # Componentes de pagos
│   │   └── admin/                # Componentes de admin
│   └── shared/                   # Componentes compartidos
│
├── lib/                          # Utilidades y configuraciones
│   ├── config/                   # Configuraciones
│   │   ├── database.ts          # Config de Supabase
│   │   ├── payments.ts           # Config de MercadoPago
│   │   └── storage.ts            # Config de Cloudinary/Storage
│   ├── services/                 # Servicios de negocio
│   │   ├── listings/             # Servicio de productos
│   │   ├── orders/               # Servicio de órdenes
│   │   ├── payments/             # Servicio de pagos
│   │   ├── logistics/            # Servicio de logística
│   │   ├── notifications/        # Servicio de notificaciones
│   │   └── admin/                # Servicios de admin
│   ├── repositories/             # Acceso a datos (abstracción de Supabase)
│   │   ├── listings.repository.ts
│   │   ├── orders.repository.ts
│   │   ├── users.repository.ts
│   │   └── ...
│   ├── types/                    # Tipos TypeScript
│   │   ├── database.types.ts     # Tipos de BD
│   │   ├── api.types.ts          # Tipos de API
│   │   └── domain.types.ts       # Tipos de dominio
│   ├── utils/                    # Utilidades generales
│   │   ├── format.ts             # Formateo (dinero, fechas, etc.)
│   │   ├── validation.ts         # Validaciones
│   │   └── errors.ts             # Manejo de errores
│   └── hooks/                    # Custom React hooks
│       ├── useAuth.ts
│       ├── useOrders.ts
│       └── ...
│
├── database/                     # Scripts y migraciones SQL
│   ├── migrations/               # Migraciones versionadas
│   ├── seeds/                    # Datos de prueba
│   └── schemas/                  # Esquemas de tablas
│
├── tests/                        # Tests (opcional pero recomendado)
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── docs/                         # Documentación
    ├── architecture.md
    ├── api.md
    └── deployment.md
```

---

## 🎨 Patrones de Diseño a Implementar

### 1. **Repository Pattern**
- Abstraer acceso a datos
- Facilita testing y cambio de BD
- Ejemplo: `ListingsRepository`, `OrdersRepository`

### 2. **Service Layer Pattern**
- Lógica de negocio separada de API routes
- Reutilizable entre diferentes endpoints
- Ejemplo: `OrderService`, `PaymentService`

### 3. **Factory Pattern**
- Crear objetos complejos
- Ejemplo: `NotificationFactory`, `PaymentMethodFactory`

### 4. **Strategy Pattern**
- Diferentes algoritmos intercambiables
- Ejemplo: `ShippingStrategy`, `PaymentStrategy`

### 5. **Observer Pattern**
- Eventos y notificaciones
- Ejemplo: `EventEmitter` para notificaciones

### 6. **Builder Pattern**
- Construcción de objetos complejos
- Ejemplo: `OrderBuilder`, `CheckoutBuilder`

---

## 📐 Convenciones de Código

### Nomenclatura

**Archivos y Carpetas:**
- Componentes: `PascalCase` (ej: `OrderCard.tsx`)
- Utilidades: `camelCase` (ej: `formatMoney.ts`)
- Constantes: `UPPER_SNAKE_CASE` (ej: `MAX_FILE_SIZE`)
- Tipos/Interfaces: `PascalCase` (ej: `OrderStatus`)

**Funciones y Variables:**
- Funciones: `camelCase` con verbo (ej: `createOrder`, `getUserProfile`)
- Variables: `camelCase` descriptivo (ej: `orderTotal`, `userEmail`)
- Constantes: `UPPER_SNAKE_CASE` (ej: `DEFAULT_PAGE_SIZE`)

**Componentes React:**
- Nombres descriptivos y específicos
- Props tipadas con TypeScript
- Un componente = una responsabilidad

### Estructura de Archivos

**Componente React:**
```typescript
// components/features/orders/OrderCard.tsx
import { Order } from '@/lib/types/domain.types';

interface OrderCardProps {
  order: Order;
  onAction?: (action: string) => void;
}

export function OrderCard({ order, onAction }: OrderCardProps) {
  // Componente
}
```

**Servicio:**
```typescript
// lib/services/orders/order.service.ts
import { OrdersRepository } from '@/lib/repositories/orders.repository';

export class OrderService {
  constructor(private repository: OrdersRepository) {}

  async createOrder(data: CreateOrderData): Promise<Order> {
    // Lógica de negocio
  }
}
```

**API Route:**
```typescript
// app/api/orders/create/route.ts
import { OrderService } from '@/lib/services/orders/order.service';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  const service = new OrderService(/* dependencies */);
  // Llamar al servicio
}
```

---

## 🔄 Flujo de Datos Propuesto

```
Frontend (React Component)
    ↓
API Route (app/api/*/route.ts)
    ↓
Service Layer (lib/services/*)
    ↓
Repository Layer (lib/repositories/*)
    ↓
Database (Supabase)
```

**Ejemplo concreto:**
```
OrderCard Component
    ↓ (onClick)
POST /api/orders/mark-shipped
    ↓
OrderService.markAsShipped()
    ↓
OrdersRepository.update()
    ↓
Supabase Database
```

---

## 📦 Módulos Principales a Reescribir

### 1. **Módulo de Autenticación**
**Ubicación**: `lib/services/auth/`, `app/api/auth/`

**Responsabilidades:**
- Login/Logout
- Registro
- Recuperación de contraseña
- Verificación de email
- Gestión de sesiones

**Estructura:**
```
lib/services/auth/
├── auth.service.ts              # Lógica de autenticación
├── session.service.ts           # Gestión de sesiones
└── password.service.ts          # Recuperación de contraseña

app/api/auth/
├── login/route.ts
├── register/route.ts
└── logout/route.ts
```

### 2. **Módulo de Productos (Listings)**
**Ubicación**: `lib/services/listings/`, `app/api/listings/`

**Responsabilidades:**
- Crear/Editar/Eliminar productos
- Búsqueda y filtrado
- Gestión de imágenes
- Estados (activo, pausado, vendido)

**Estructura:**
```
lib/services/listings/
├── listing.service.ts          # Lógica de productos
├── listing-search.service.ts   # Búsqueda
└── listing-images.service.ts   # Gestión de imágenes

lib/repositories/
└── listings.repository.ts      # Acceso a datos
```

### 3. **Módulo de Órdenes**
**Ubicación**: `lib/services/orders/`, `app/api/orders/`

**Responsabilidades:**
- Crear órdenes desde carrito
- Actualizar estados (pending_payment, paid, shipped, etc.)
- Calcular totales (subtotal, shipping, commission)
- Gestión de items de orden

**Estructura:**
```
lib/services/orders/
├── order.service.ts            # Lógica principal
├── order-calculator.service.ts # Cálculos
└── order-status.service.ts     # Transiciones de estado

lib/repositories/
└── orders.repository.ts
```

### 4. **Módulo de Pagos**
**Ubicación**: `lib/services/payments/`, `app/api/payments/`

**Responsabilidades:**
- Integración con MercadoPago
- Pagos offline (transferencia, depósito, OXXO)
- Gestión de sesiones de checkout
- Webhooks y confirmaciones

**Estructura:**
```
lib/services/payments/
├── payment.service.ts          # Lógica principal
├── mercadopago.service.ts     # Integración MP
├── offline-payment.service.ts # Pagos offline
└── payment-validator.service.ts # Validaciones

lib/repositories/
└── payments.repository.ts
```

### 5. **Módulo de Logística**
**Ubicación**: `lib/services/logistics/`, `app/api/logistics/`

**Responsabilidades:**
- Gestión de guías de envío
- Subida de etiquetas
- Tracking de paquetes
- Integración con paqueterías

**Estructura:**
```
lib/services/logistics/
├── shipping.service.ts        # Lógica principal
├── label.service.ts           # Gestión de guías
└── tracking.service.ts        # Rastreo

lib/repositories/
└── logistics.repository.ts
```

### 6. **Módulo de Notificaciones**
**Ubicación**: `lib/services/notifications/`, `app/api/notifications/`

**Responsabilidades:**
- Crear notificaciones
- Enviar notificaciones (push, email)
- Marcar como leídas
- Tiempo real (Supabase Realtime)

**Estructura:**
```
lib/services/notifications/
├── notification.service.ts     # Lógica principal
├── notification-sender.service.ts # Envío
└── notification-realtime.service.ts # Tiempo real

lib/repositories/
└── notifications.repository.ts
```

### 7. **Módulo de Administración**
**Ubicación**: `lib/services/admin/`, `app/api/admin/`

**Responsabilidades:**
- Gestión de usuarios
- Supervisión de operaciones
- Métricas y reportes
- Configuración del sistema

**Estructura:**
```
lib/services/admin/
├── admin.service.ts           # Lógica principal
├── user-management.service.ts # Gestión de usuarios
├── metrics.service.ts         # Métricas
└── supervision.service.ts    # Supervisión

lib/repositories/
└── admin.repository.ts
```

---

## 🔐 Seguridad y Validación

### 1. **Autenticación y Autorización**
- Middleware de autenticación reutilizable
- Verificación de roles (admin, seller, buyer)
- Validación de permisos en cada endpoint

### 2. **Validación de Datos**
- Validación en frontend (UX)
- Validación en backend (seguridad)
- Schemas de validación (Zod o similar)

### 3. **Sanitización**
- Sanitizar inputs del usuario
- Prevenir SQL injection (Supabase lo hace, pero validar)
- Prevenir XSS

### 4. **Rate Limiting**
- Limitar requests por usuario
- Prevenir abuso de APIs
- Protección contra DDoS

---

## 🧪 Testing (Opcional pero Recomendado)

### Estructura de Tests
```
tests/
├── unit/                        # Tests unitarios
│   ├── services/
│   └── utils/
├── integration/                 # Tests de integración
│   └── api/
└── e2e/                        # Tests end-to-end
    └── flows/
```

### Cobertura Mínima
- Servicios críticos: 80%+
- Utilidades: 90%+
- Componentes complejos: 70%+

---

## 📝 Plan de Migración

### Fase 1: Preparación (1-2 días)
1. ✅ Crear nueva estructura de carpetas
2. ✅ Configurar TypeScript paths
3. ✅ Crear tipos base
4. ✅ Configurar herramientas (ESLint, Prettier)

### Fase 2: Core (3-5 días)
1. ✅ Reescribir módulo de autenticación
2. ✅ Reescribir módulo de productos
3. ✅ Reescribir módulo de órdenes
4. ✅ Reescribir módulo de pagos

### Fase 3: Features (5-7 días)
1. ✅ Reescribir módulo de logística
2. ✅ Reescribir módulo de notificaciones
3. ✅ Reescribir módulo de admin
4. ✅ Reescribir componentes frontend

### Fase 4: Integración (2-3 días)
1. ✅ Integrar todos los módulos
2. ✅ Probar flujos completos
3. ✅ Corregir bugs
4. ✅ Optimizar performance

### Fase 5: Testing y Deploy (2-3 días)
1. ✅ Tests básicos
2. ✅ Deploy a staging
3. ✅ Pruebas de usuario
4. ✅ Deploy a producción

**Total estimado: 13-20 días**

---

## ✅ Checklist de Implementación

### Estructura Base
- [ ] Crear estructura de carpetas propuesta
- [ ] Configurar TypeScript paths en `tsconfig.json`
- [ ] Crear tipos base en `lib/types/`
- [ ] Configurar ESLint y Prettier

### Módulo de Autenticación
- [ ] Crear `AuthService`
- [ ] Crear `SessionService`
- [ ] Crear middleware `requireAuth`
- [ ] Reescribir API routes de auth
- [ ] Reescribir componentes de login/register

### Módulo de Productos
- [ ] Crear `ListingsRepository`
- [ ] Crear `ListingService`
- [ ] Reescribir API routes de listings
- [ ] Reescribir componentes de productos
- [ ] Implementar búsqueda y filtrado

### Módulo de Órdenes
- [ ] Crear `OrdersRepository`
- [ ] Crear `OrderService`
- [ ] Crear `OrderCalculator`
- [ ] Reescribir API routes de orders
- [ ] Reescribir componentes de órdenes

### Módulo de Pagos
- [ ] Crear `PaymentsRepository`
- [ ] Crear `PaymentService`
- [ ] Crear `MercadoPagoService`
- [ ] Crear `OfflinePaymentService`
- [ ] Reescribir API routes de pagos
- [ ] Reescribir componentes de pagos

### Módulo de Logística
- [ ] Crear `LogisticsRepository`
- [ ] Crear `ShippingService`
- [ ] Crear `LabelService`
- [ ] Reescribir API routes de logística
- [ ] Reescribir componentes de logística

### Módulo de Notificaciones
- [ ] Crear `NotificationsRepository`
- [ ] Crear `NotificationService`
- [ ] Implementar tiempo real
- [ ] Reescribir API routes de notificaciones
- [ ] Reescribir componentes de notificaciones

### Módulo de Admin
- [ ] Crear `AdminRepository`
- [ ] Crear `AdminService`
- [ ] Crear `UserManagementService`
- [ ] Reescribir API routes de admin
- [ ] Reescribir componentes de admin

### Utilidades
- [ ] Crear utilidades de formateo
- [ ] Crear utilidades de validación
- [ ] Crear manejo de errores centralizado
- [ ] Crear hooks de React reutilizables

### Frontend
- [ ] Reescribir componentes UI base
- [ ] Reescribir componentes de layout
- [ ] Reescribir páginas principales
- [ ] Implementar manejo de estado (si es necesario)
- [ ] Optimizar performance

### Testing
- [ ] Tests unitarios de servicios
- [ ] Tests de integración de APIs
- [ ] Tests E2E de flujos críticos

### Documentación
- [ ] Documentar arquitectura
- [ ] Documentar APIs
- [ ] Documentar flujos principales
- [ ] Crear guías de desarrollo

---

## 🎯 Principios de Código Limpio

### 1. **Funciones Pequeñas y Enfocadas**
- Una función = una responsabilidad
- Máximo 20-30 líneas por función
- Nombres descriptivos

### 2. **Eliminar Código Muerto**
- No dejar código comentado
- Eliminar funciones no usadas
- Limpiar imports no utilizados

### 3. **Manejo de Errores Consistente**
- Usar tipos de error específicos
- Mensajes de error claros
- Logging apropiado

### 4. **Comentarios Útiles**
- Comentar "por qué", no "qué"
- Documentar decisiones complejas
- Mantener comentarios actualizados

### 5. **Código Auto-documentado**
- Nombres descriptivos
- Estructura clara
- Tipos TypeScript completos

---

## 🔄 Migración de Datos

### Estrategia
1. **Mantener BD existente** (no recrear)
2. **Crear nuevas tablas si es necesario** (migraciones)
3. **Migrar datos gradualmente** si hay cambios de esquema
4. **Mantener compatibilidad** durante la transición

### Scripts de Migración
- Crear en `database/migrations/`
- Versionados y ejecutables
- Reversibles si es posible

---

## 📊 Métricas de Calidad

### Código
- Complejidad ciclomática < 10
- Cobertura de tests > 70%
- Sin código duplicado
- Sin dependencias circulares

### Performance
- Tiempo de respuesta API < 500ms
- Tiempo de carga inicial < 3s
- Optimización de imágenes
- Lazy loading donde sea apropiado

### Seguridad
- Todas las rutas protegidas
- Validación de inputs
- Sanitización de datos
- Rate limiting implementado

---

## 🚀 Guía de Implementación Paso a Paso

### Paso 1: Setup Inicial
```bash
# 1. Crear estructura de carpetas
mkdir -p lib/{services,repositories,types,utils,hooks}
mkdir -p components/{ui,layout,features,shared}
mkdir -p database/{migrations,seeds,schemas}

# 2. Configurar TypeScript paths
# En tsconfig.json:
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/lib/*": ["./lib/*"],
      "@/components/*": ["./components/*"]
    }
  }
}
```

### Paso 2: Crear Tipos Base
```typescript
// lib/types/domain.types.ts
export type OrderStatus = 
  | 'pending_payment'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  // ...
}
```

### Paso 3: Crear Repository
```typescript
// lib/repositories/orders.repository.ts
import { supabaseAdmin } from '@/lib/config/database';
import { Order } from '@/lib/types/domain.types';

export class OrdersRepository {
  async findById(id: string): Promise<Order | null> {
    const { data, error } = await supabaseAdmin()
      .from('orders')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw new Error(`Failed to find order: ${error.message}`);
    return data;
  }

  async create(order: CreateOrderData): Promise<Order> {
    const { data, error } = await supabaseAdmin()
      .from('orders')
      .insert(order)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create order: ${error.message}`);
    return data;
  }
}
```

### Paso 4: Crear Service
```typescript
// lib/services/orders/order.service.ts
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { Order, CreateOrderData } from '@/lib/types/domain.types';

export class OrderService {
  constructor(private repository: OrdersRepository) {}

  async createOrder(data: CreateOrderData): Promise<Order> {
    // Validaciones
    this.validateOrderData(data);
    
    // Lógica de negocio
    const order = await this.repository.create(data);
    
    // Eventos/Notificaciones
    await this.notifyOrderCreated(order);
    
    return order;
  }

  private validateOrderData(data: CreateOrderData): void {
    if (!data.buyer_id) throw new Error('buyer_id is required');
    if (!data.seller_id) throw new Error('seller_id is required');
    if (data.total <= 0) throw new Error('total must be greater than 0');
  }

  private async notifyOrderCreated(order: Order): Promise<void> {
    // Lógica de notificación
  }
}
```

### Paso 5: Crear API Route
```typescript
// app/api/orders/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '@/lib/services/orders/order.service';
import { OrdersRepository } from '@/lib/repositories/orders.repository';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(req: NextRequest) {
  try {
    // Autenticación
    const user = await requireAuth(req);
    
    // Parse body
    const body = await req.json();
    
    // Inicializar servicios
    const repository = new OrdersRepository();
    const service = new OrderService(repository);
    
    // Crear orden
    const order = await service.createOrder({
      ...body,
      buyer_id: user.id,
    });
    
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

## 🎨 Ejemplo Completo: Módulo de Órdenes

### Estructura Completa
```
lib/
├── types/
│   └── domain.types.ts          # Order, OrderStatus, etc.
├── repositories/
│   └── orders.repository.ts     # Acceso a BD
├── services/
│   └── orders/
│       ├── order.service.ts     # Lógica principal
│       ├── order-calculator.service.ts
│       └── order-status.service.ts
└── utils/
    └── validation.ts            # Validaciones

app/
└── api/
    └── orders/
        ├── create/
        │   └── route.ts
        ├── [id]/
        │   ├── route.ts
        │   └── mark-shipped/
        │       └── route.ts
        └── list/
            └── route.ts

components/
└── features/
    └── orders/
        ├── OrderCard.tsx
        ├── OrderList.tsx
        └── OrderStatusBadge.tsx
```

---

## 🔍 Checklist de Calidad por Módulo

Para cada módulo, verificar:

- [ ] **Separación de responsabilidades**: Repository, Service, API separados
- [ ] **Tipos TypeScript**: Todos los tipos definidos
- [ ] **Validación**: Inputs validados en Service
- [ ] **Manejo de errores**: Errores manejados apropiadamente
- [ ] **Logging**: Logs apropiados para debugging
- [ ] **Documentación**: Comentarios donde sea necesario
- [ ] **Testing**: Tests básicos (opcional pero recomendado)
- [ ] **Performance**: Queries optimizadas
- [ ] **Seguridad**: Autenticación y autorización verificadas

---

## 📚 Recursos y Referencias

### Patrones de Diseño
- Repository Pattern
- Service Layer Pattern
- Factory Pattern
- Strategy Pattern

### Principios
- SOLID
- DRY
- KISS
- YAGNI

### Mejores Prácticas
- Clean Code (Robert C. Martin)
- Refactoring (Martin Fowler)
- Design Patterns (Gang of Four)

---

## 🎯 Resultado Esperado

Al finalizar la reescritura, deberías tener:

1. ✅ **Código limpio y mantenible**
   - Fácil de entender
   - Fácil de modificar
   - Fácil de extender

2. ✅ **Arquitectura escalable**
   - Módulos independientes
   - Fácil agregar nuevas features
   - Performance optimizado

3. ✅ **Código testeable**
   - Servicios testables
   - Mocks fáciles de crear
   - Tests rápidos

4. ✅ **Documentación clara**
   - Estructura documentada
   - APIs documentadas
   - Flujos documentados

5. ✅ **Onboarding rápido**
   - Nuevos desarrolladores pueden entender rápido
   - Código auto-documentado
   - Convenciones claras

---

## 🚨 Advertencias Importantes

### ⚠️ NO Borrar Todo de Una Vez
- Reescribir módulo por módulo
- Mantener funcionalidad existente
- Migrar gradualmente

### ⚠️ NO Romper Funcionalidad Existente
- Probar cada módulo antes de continuar
- Mantener compatibilidad con BD
- No eliminar features sin reemplazo

### ⚠️ NO Sobre-ingeniería
- Mantener simple
- Solo lo necesario
- Evitar abstracciones innecesarias

---

## 📝 Notas Finales

Este prompt es una **guía completa** para reescribir el código de manera lógica y racional. 

**Recomendación**: 
- Empezar con un módulo pequeño (ej: notificaciones)
- Validar que la estructura funciona
- Ir escalando a módulos más complejos
- Mantener tests y documentación actualizados

**Tiempo estimado**: 2-3 semanas de desarrollo intensivo para reescribir completamente.

**Prioridad**: 
1. Core (auth, listings, orders, payments)
2. Features (logistics, notifications, admin)
3. Polish (optimización, tests, documentación)
