# PROMPT: Enlaces Globales de Vendedor - GoPocket

## OBJETIVO PRINCIPAL

Implementar un sistema unificado para que **todos los nombres de vendedores** en la aplicación aparezcan como **enlaces clicables** que lleven a la página correspondiente (perfil o tienda del vendedor), mejorando la navegabilidad y consistencia en toda la aplicación.

---

## ARQUITECTURA ACTUAL (Base Existente)

### Componentes Existentes:
- ✅ Componente `SellerDisplay` en `components/SellerDisplay.tsx`
  - Muestra "Vendido por [Nombre]" con enlace a `/perfil/${sellerId}`
  - Soporta badge verificado, ubicación, operaciones
  - Tamaños: `sm` y `md`

### Rutas Existentes:
- ✅ `/perfil/[id]` - Perfil público del usuario/vendedor
- ✅ `/tienda/[sellerId]` - Tienda del vendedor con sus publicaciones
- ✅ `/api/sellers/[id]` - API para obtener datos del vendedor

### Lugares Donde Se Muestra el Nombre del Vendedor:
1. **Página de detalle de listing** (`app/listings/[id]/page.tsx`)
2. **Dashboard de compras** (`app/dashboard/compras/page.tsx`)
3. **Dashboard de ventas** (`app/dashboard/ventas/page.tsx`)
4. **Dashboard de disputas/devoluciones** (`app/dashboard/devoluciones/page.tsx`)
5. **Panel de administración - Logística** (`app/admin/logistica/page.tsx`)
6. **Panel de administración - Métricas** (`app/admin/metricas/page.tsx`)
7. **Panel de administración - Usuarios** (`app/admin/usuarios/page.tsx`)
8. **Panel de administración - Listings** (`app/admin/listings/page.tsx`)
9. **Panel de administración - Supervisión** (`app/admin/supervision/page.tsx`)
10. **Página de tienda** (`app/tienda/[sellerId]/page.tsx`)

---

## REQUERIMIENTOS ESPECÍFICOS

### 1. COMPONENTE REUTILIZABLE MEJORADO

**Mejorar `components/SellerDisplay.tsx` para soportar más casos de uso:**

```typescript
'use client';

import Link from 'next/link';
import { VerifiedBadge } from '@/components/VerifiedBadge';

export type SellerDisplayProps = {
  /** ID del vendedor (requerido para enlace) */
  sellerId: string;
  /** Nombre a mostrar (fallback "Vendedor") */
  sellerName: string;
  /** Estado de registro (opcional) */
  state?: string | null;
  /** Municipio/ciudad de registro (opcional) */
  city?: string | null;
  /** Mostrar insignia verificado */
  isVerified?: boolean;
  /** Operaciones en el sitio (ventas + compras) */
  operationsCount?: number | null;
  /** Tamaño: sm (compacto) o md */
  size?: 'sm' | 'md';
  /** Mostrar "Ubicado en estado, municipio" cuando existan */
  showUbicado?: boolean;
  /** Clases extra para el contenedor */
  className?: string;
  /** Tipo de enlace: 'profile' (perfil) o 'store' (tienda) */
  linkType?: 'profile' | 'store';
  /** Mostrar solo el nombre (sin "Vendido por") */
  nameOnly?: boolean;
  /** Estilo del enlace: 'pink' (brand-pink) o 'default' (gris) */
  linkStyle?: 'pink' | 'default';
};

/**
 * Componente reutilizable para mostrar nombre de vendedor con enlace
 * Usar en: listings, órdenes, disputas, paneles admin, etc.
 */
export function SellerDisplay({
  sellerId,
  sellerName,
  state,
  city,
  isVerified = false,
  operationsCount,
  size = 'md',
  showUbicado = true,
  className = '',
  linkType = 'profile', // 'profile' o 'store'
  nameOnly = false,
  linkStyle = 'pink',
}: SellerDisplayProps) {
  const name = (sellerName || 'Vendedor').trim() || 'Vendedor';
  const hasUbicado = showUbicado && (state || city);
  const ubicado = [state, city].filter(Boolean).join(', ').toUpperCase();
  const ops = typeof operationsCount === 'number' && operationsCount >= 0 ? operationsCount : null;

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  
  // Estilo del enlace según linkStyle
  const linkClass = linkStyle === 'pink'
    ? size === 'sm'
      ? 'font-semibold text-brand-pink hover:opacity-90 hover:underline'
      : 'font-semibold text-brand-pink hover:opacity-90'
    : size === 'sm'
      ? 'font-medium text-gray-900 hover:text-brand-pink hover:underline'
      : 'font-medium text-gray-900 hover:text-brand-pink';

  // URL según linkType
  const href = linkType === 'store' ? `/tienda/${sellerId}` : `/perfil/${sellerId}`;

  // Si nameOnly, solo mostrar el nombre con enlace
  if (nameOnly) {
    return (
      <span className={className}>
        <Link href={href} className={linkClass}>
          {name}
        </Link>
        {isVerified && <VerifiedBadge size={size === 'sm' ? 'sm' : 'md'} />}
      </span>
    );
  }

  // Versión completa con "Vendido por"
  return (
    <div className={className}>
      <div className={`flex flex-wrap items-center gap-2 ${textSize}`}>
        <span className="text-gray-600">Vendido por</span>
        <Link href={href} className={linkClass}>
          {name}
        </Link>
        {isVerified && <VerifiedBadge size={size === 'sm' ? 'sm' : 'md'} />}
        {ops !== null && (
          <span className="text-gray-500">
            · {ops} {ops === 1 ? 'operación' : 'operaciones'}
          </span>
        )}
      </div>
      {hasUbicado && ubicado && (
        <div className={`mt-1 ${textSize}`}>
          <span className="text-gray-600">Ubicado en </span>
          <span className="font-semibold text-brand-pink">{ubicado}</span>
        </div>
      )}
    </div>
  );
}
```

### 2. COMPONENTE SIMPLE PARA NOMBRES SOLOS

**Crear `components/SellerNameLink.tsx` para casos donde solo se necesita el nombre:**

```typescript
'use client';

import Link from 'next/link';
import { VerifiedBadge } from '@/components/VerifiedBadge';

export type SellerNameLinkProps = {
  sellerId: string;
  sellerName: string;
  isVerified?: boolean;
  linkType?: 'profile' | 'store';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

/**
 * Componente simple para mostrar solo el nombre del vendedor como enlace
 * Útil para tablas, listas, etc. donde no se necesita "Vendido por"
 */
export function SellerNameLink({
  sellerId,
  sellerName,
  isVerified = false,
  linkType = 'profile',
  className = '',
  size = 'md',
}: SellerNameLinkProps) {
  const name = (sellerName || 'Vendedor').trim() || 'Vendedor';
  const href = linkType === 'store' ? `/tienda/${sellerId}` : `/perfil/${sellerId}`;
  
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <span className={className}>
      <Link
        href={href}
        className={`font-semibold text-brand-pink hover:opacity-90 hover:underline ${sizeClasses[size]}`}
      >
        {name}
      </Link>
      {isVerified && <VerifiedBadge size={size === 'sm' ? 'sm' : 'md'} />}
    </span>
  );
}
```

---

## 3. LUGARES A MODIFICAR

### A. Página de Detalle de Listing
**Archivo:** `app/listings/[id]/page.tsx`

**Cambio requerido:**
- Ya usa `SellerDisplay` ✅
- Verificar que esté correctamente implementado

**Código actual (verificar):**
```tsx
<SellerDisplay
  sellerId={listing.seller_id}
  sellerName={sellerName}
  state={sellerState}
  city={sellerCity}
  isVerified={sellerIsVerified}
  operationsCount={sellerOperationsCount}
/>
```

### B. Dashboard de Compras
**Archivo:** `app/dashboard/compras/page.tsx`

**Cambio requerido:**
- Reemplazar texto plano del vendedor por `SellerNameLink` o `SellerDisplay`

**Buscar y reemplazar:**
```tsx
// ANTES:
const seller = sellerId ? sellerNames[sellerId] || `${sellerId.slice(0, 6)}…` : '—';
// ... en el render:
<span>{seller}</span>

// DESPUÉS:
{sellerId ? (
  <SellerNameLink
    sellerId={sellerId}
    sellerName={sellerNames[sellerId] || 'Vendedor'}
    linkType="store"
    size="sm"
  />
) : (
  <span>—</span>
)}
```

### C. Dashboard de Ventas
**Archivo:** `app/dashboard/ventas/page.tsx`

**Cambio requerido:**
- Reemplazar nombres de compradores por enlaces (si aplica)
- Asegurar que nombres de vendedor (si se muestran) sean enlaces

**Buscar:**
```tsx
// Buscar donde se muestra buyerName o buyer_id
// Si se muestra el nombre del comprador, también hacerlo enlace a /perfil/[buyerId]
```

### D. Dashboard de Devoluciones/Disputas
**Archivo:** `app/dashboard/devoluciones/page.tsx`

**Cambio requerido:**
- Ya usa `SellerDisplay` en algunos lugares ✅
- Verificar que todos los nombres de vendedor usen el componente

**Código actual (verificar):**
```tsx
{sellerId ? (
  <SellerDisplay
    sellerId={sellerId}
    sellerName={sellerName}
    state={sellerStateById[sellerId] ?? null}
    city={sellerCityById[sellerId] ?? null}
    operationsCount={sellerOperationsById[sellerId] ?? null}
    size="sm"
  />
) : (
  <>
    <span className="text-gray-600">Vendedor:</span>{' '}
    <span className="font-semibold text-gray-900">{sellerName}</span>
  </>
)}
```

**Mejorar:**
```tsx
{sellerId ? (
  <SellerDisplay
    sellerId={sellerId}
    sellerName={sellerName}
    state={sellerStateById[sellerId] ?? null}
    city={sellerCityById[sellerId] ?? null}
    operationsCount={sellerOperationsById[sellerId] ?? null}
    size="sm"
  />
) : (
  <>
    <span className="text-gray-600">Vendedor:</span>{' '}
    <SellerNameLink
      sellerId={sellerId || ''}
      sellerName={sellerName}
      size="sm"
    />
  </>
)}
```

### E. Panel de Administración - Logística
**Archivo:** `app/admin/logistica/page.tsx`

**Cambio requerido:**
- Buscar donde se muestra `seller_name` o `seller_id`
- Reemplazar por `SellerNameLink`

**Buscar:**
```tsx
// Buscar patrones como:
<td>{order.seller_name}</td>
// o
<span>{sellerName}</span>
```

**Reemplazar:**
```tsx
import { SellerNameLink } from '@/components/SellerNameLink';

// En el render:
<td>
  {order.seller_id ? (
    <SellerNameLink
      sellerId={order.seller_id}
      sellerName={order.seller_name || 'Vendedor'}
      linkType="store"
      size="sm"
    />
  ) : (
    <span>—</span>
  )}
</td>
```

### F. Panel de Administración - Métricas
**Archivo:** `app/admin/metricas/page.tsx`

**Cambio requerido:**
- Buscar donde se muestra `seller_name` o `full_name` de vendedores
- Reemplazar por `SellerNameLink`

**Buscar:**
```tsx
// Buscar patrones como:
{s?.seller_name || sid}
// o
{u.full_name?.trim() || `${u.id.slice(0, 8)}…`}
```

**Reemplazar:**
```tsx
import { SellerNameLink } from '@/components/SellerNameLink';

// En el render:
{sellerId ? (
  <SellerNameLink
    sellerId={sellerId}
    sellerName={sellerName || 'Vendedor'}
    linkType="store"
    size="sm"
  />
) : (
  <span>{sellerId.slice(0, 8)}…</span>
)}
```

### G. Panel de Administración - Usuarios
**Archivo:** `app/admin/usuarios/page.tsx`

**Cambio requerido:**
- Si se muestra el nombre del usuario seleccionado, hacerlo enlace
- Verificar que los nombres en la lista sean enlaces

**Buscar:**
```tsx
// Buscar donde se muestra full_name del usuario
```

**Reemplazar:**
```tsx
import { SellerNameLink } from '@/components/SellerNameLink';

// Si es vendedor (tiene listings), enlace a tienda
// Si no, enlace a perfil
{selectedUser?.id ? (
  <SellerNameLink
    sellerId={selectedUser.id}
    sellerName={selectedUser.full_name || 'Usuario'}
    linkType={hasListings ? 'store' : 'profile'}
    size="md"
  />
) : (
  <span>{selectedUser?.full_name || 'Usuario'}</span>
)}
```

### H. Panel de Administración - Listings
**Archivo:** `app/admin/listings/page.tsx`

**Cambio requerido:**
- Buscar donde se muestra el nombre del vendedor
- Reemplazar por `SellerNameLink`

### I. Panel de Administración - Supervisión
**Archivo:** `app/admin/supervision/page.tsx`

**Cambio requerido:**
- Buscar donde se muestra el nombre del vendedor
- Reemplazar por `SellerNameLink`

### J. Página de Tienda
**Archivo:** `app/tienda/[sellerId]/page.tsx`

**Cambio requerido:**
- Ya usa `SellerDisplay` ✅
- Verificar que esté correctamente implementado

---

## 4. UTILIDADES PARA OBTENER DATOS DEL VENDEDOR

### A. Hook para Cargar Datos del Vendedor
**Archivo:** `lib/hooks/useSeller.ts`

```typescript
import { useState, useEffect } from 'react';

export interface SellerData {
  id: string;
  name: string;
  state?: string | null;
  city?: string | null;
  isVerified?: boolean;
  operationsCount?: number | null;
}

export function useSeller(sellerId: string | null | undefined) {
  const [seller, setSeller] = useState<SellerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sellerId) {
      setSeller(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadSeller = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch(`/api/sellers/${encodeURIComponent(sellerId)}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.error || 'Error cargando vendedor');
        }

        if (!cancelled) {
          setSeller({
            id: sellerId,
            name: json.name || 'Vendedor',
            state: json.state || null,
            city: json.city || null,
            isVerified: json.is_verified || false,
            operationsCount: json.operations_count || null,
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Error cargando vendedor');
          setSeller({
            id: sellerId,
            name: 'Vendedor',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadSeller();

    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  return { seller, isLoading, error };
}
```

### B. Función para Obtener Múltiples Vendedores
**Archivo:** `lib/utils/sellers.ts`

```typescript
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface SellerInfo {
  id: string;
  name: string;
  state?: string | null;
  city?: string | null;
  isVerified?: boolean;
}

/**
 * Obtiene información de múltiples vendedores de una vez
 * Útil para tablas con muchos vendedores
 */
export async function getSellersInfo(sellerIds: string[]): Promise<Record<string, SellerInfo>> {
  if (sellerIds.length === 0) return {};

  const admin = supabaseAdmin();
  const uniqueIds = [...new Set(sellerIds.filter(Boolean))];

  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, full_name, state, city, is_verified')
    .in('id', uniqueIds);

  if (error || !profiles) {
    console.error('[getSellersInfo] Error:', error);
    return {};
  }

  const result: Record<string, SellerInfo> = {};

  for (const profile of profiles) {
    result[profile.id] = {
      id: profile.id,
      name: profile.full_name?.trim() || 'Vendedor',
      state: profile.state || null,
      city: profile.city || null,
      isVerified: profile.is_verified || false,
    };
  }

  // Rellenar con datos por defecto para IDs no encontrados
  for (const id of uniqueIds) {
    if (!result[id]) {
      result[id] = {
        id,
        name: 'Vendedor',
      };
    }
  }

  return result;
}
```

---

## 5. PATRÓN DE BÚSQUEDA Y REEMPLAZO

### Patrones Comunes a Buscar:

1. **Texto plano con nombre:**
```tsx
// Buscar:
<span>{sellerName}</span>
<td>{order.seller_name}</td>
<div>{user.full_name}</div>

// Reemplazar por:
<SellerNameLink sellerId={sellerId} sellerName={sellerName} />
```

2. **Condicionales con nombre:**
```tsx
// Buscar:
{sellerName ? <span>{sellerName}</span> : <span>—</span>}

// Reemplazar por:
{sellerId ? (
  <SellerNameLink sellerId={sellerId} sellerName={sellerName || 'Vendedor'} />
) : (
  <span>—</span>
)}
```

3. **En tablas:**
```tsx
// Buscar:
<td className="text-sm">{row.seller_name}</td>

// Reemplazar por:
<td className="text-sm">
  {row.seller_id ? (
    <SellerNameLink
      sellerId={row.seller_id}
      sellerName={row.seller_name || 'Vendedor'}
      linkType="store"
      size="sm"
    />
  ) : (
    <span>—</span>
  )}
</td>
```

4. **Con fallback de ID:**
```tsx
// Buscar:
{sellerName || `${sellerId.slice(0, 8)}…`}

// Reemplazar por:
<SellerNameLink
  sellerId={sellerId}
  sellerName={sellerName || 'Vendedor'}
  size="sm"
/>
```

---

## 6. CHECKLIST DE IMPLEMENTACIÓN

### Componentes:
- [ ] Mejorar `components/SellerDisplay.tsx` con nuevas props
- [ ] Crear `components/SellerNameLink.tsx` para casos simples
- [ ] Crear `lib/hooks/useSeller.ts` para cargar datos
- [ ] Crear `lib/utils/sellers.ts` para obtener múltiples vendedores

### Páginas de Usuario:
- [ ] Verificar `app/listings/[id]/page.tsx` usa `SellerDisplay`
- [ ] Modificar `app/dashboard/compras/page.tsx`
- [ ] Modificar `app/dashboard/ventas/page.tsx`
- [ ] Verificar `app/dashboard/devoluciones/page.tsx`
- [ ] Verificar `app/tienda/[sellerId]/page.tsx`

### Paneles de Administración:
- [ ] Modificar `app/admin/logistica/page.tsx`
- [ ] Modificar `app/admin/metricas/page.tsx`
- [ ] Modificar `app/admin/usuarios/page.tsx`
- [ ] Modificar `app/admin/listings/page.tsx`
- [ ] Modificar `app/admin/supervision/page.tsx`

### Testing:
- [ ] Probar que todos los enlaces funcionan correctamente
- [ ] Verificar que los enlaces llevan a la ruta correcta
- [ ] Probar en diferentes tamaños de pantalla
- [ ] Verificar que los nombres se muestran correctamente
- [ ] Probar con vendedores sin nombre (fallback)

---

## 7. REGLAS DE NAVEGACIÓN

### ¿Cuándo usar `/perfil/[id]` vs `/tienda/[sellerId]`?

- **`/perfil/[id]`** (linkType: 'profile'):
  - Cuando se muestra información general del usuario
  - En contextos donde el usuario puede ser comprador o vendedor
  - En paneles de administración cuando se muestra información del usuario

- **`/tienda/[sellerId]`** (linkType: 'store'):
  - Cuando se muestra específicamente como vendedor
  - En listings, órdenes, ventas
  - Cuando el contexto es comercial (venta de productos)

### Estilo del Enlace:

- **`linkStyle: 'pink'`** (default):
  - Para nombres de vendedores en contexto comercial
  - En listings, órdenes, ventas
  - Color: `text-brand-pink`

- **`linkStyle: 'default'`**:
  - Para nombres en contextos administrativos
  - Cuando se necesita un estilo más neutro
  - Color: `text-gray-900` con hover a `text-brand-pink`

---

## 8. EJEMPLOS DE USO

### Ejemplo 1: En una Tabla de Órdenes
```tsx
import { SellerNameLink } from '@/components/SellerNameLink';

// En el render de la tabla:
<td>
  {order.seller_id ? (
    <SellerNameLink
      sellerId={order.seller_id}
      sellerName={order.seller_name || 'Vendedor'}
      linkType="store"
      size="sm"
    />
  ) : (
    <span className="text-gray-400">—</span>
  )}
</td>
```

### Ejemplo 2: En una Lista de Publicaciones
```tsx
import { SellerDisplay } from '@/components/SellerDisplay';

// En el render:
<SellerDisplay
  sellerId={listing.seller_id}
  sellerName={sellerName}
  state={sellerState}
  city={sellerCity}
  isVerified={sellerIsVerified}
  operationsCount={sellerOperationsCount}
  size="sm"
  linkType="store"
/>
```

### Ejemplo 3: En Panel de Administración
```tsx
import { SellerNameLink } from '@/components/SellerNameLink';

// En el render:
<div className="flex items-center gap-2">
  <span className="text-gray-600">Vendedor:</span>
  {sellerId ? (
    <SellerNameLink
      sellerId={sellerId}
      sellerName={sellerName}
      linkType="store"
      size="sm"
    />
  ) : (
    <span>No disponible</span>
  )}
</div>
```

### Ejemplo 4: Con Hook para Cargar Datos
```tsx
import { useSeller } from '@/lib/hooks/useSeller';
import { SellerDisplay } from '@/components/SellerDisplay';

function MyComponent({ sellerId }: { sellerId: string }) {
  const { seller, isLoading } = useSeller(sellerId);

  if (isLoading) return <span>Cargando...</span>;
  if (!seller) return <span>Vendedor no encontrado</span>;

  return (
    <SellerDisplay
      sellerId={seller.id}
      sellerName={seller.name}
      state={seller.state}
      city={seller.city}
      isVerified={seller.isVerified}
      operationsCount={seller.operationsCount}
    />
  );
}
```

---

## 9. MEJORAS FUTURAS

### A. Tooltip con Información del Vendedor
- Agregar tooltip al hacer hover sobre el nombre
- Mostrar: reputación, operaciones, ubicación

### B. Badge de Estado
- Mostrar badge si el vendedor está activo/inactivo
- Mostrar badge de verificación si está verificado

### C. Prefetch de Datos
- Prefetch de datos del vendedor cuando se hace hover
- Mejorar tiempo de carga de la página de destino

### D. Analytics
- Trackear clicks en nombres de vendedores
- Medir navegación entre secciones

---

## NOTAS FINALES

- **Consistencia:** Todos los nombres de vendedores deben ser enlaces
- **Accesibilidad:** Los enlaces deben tener texto descriptivo
- **Performance:** Usar `getSellersInfo` para cargar múltiples vendedores de una vez
- **Fallbacks:** Siempre tener un fallback si el nombre no está disponible

---

**Este prompt debe ser ejecutado por un agente de IA o desarrollador para implementar el sistema completo de enlaces globales de vendedor.**
