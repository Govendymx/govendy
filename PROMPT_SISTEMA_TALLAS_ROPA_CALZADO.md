# PROMPT: Sistema de Tallas de Ropa y Calzado - GoPocket

## OBJETIVO PRINCIPAL

Implementar un sistema completo de gestión de tallas para publicaciones que:
1. **Organice tallas de ropa** en un selector predefinido (SCH, CH, M, L, XL, XXL, XXXL, XXXXL)
2. **Organice tallas de calzado** según sistema mexicano (niños, hombres, mujeres, niñas)
3. **Muestre selectores inteligentes** según la categoría seleccionada
4. **Gestione stock por talla** para control de inventario
5. **Facilite la compra** con selección clara de tallas
6. **Valide disponibilidad** antes de permitir compra

---

## ARQUITECTURA ACTUAL (Base Existente)

### Componentes Existentes:
- ✅ Tabla `listings` con columna `size_variants` (TEXT[] - array de tallas)
- ✅ Tabla `listings` con columna `stock` (INTEGER - stock general)
- ✅ Tabla `cart_items` con columna `selected_size` (TEXT - talla seleccionada)
- ✅ Formulario de publicación en `app/sell/page.tsx`
- ✅ Página de detalle de producto en `app/listings/[id]/page.tsx`
- ✅ API de creación: `app/api/listings/create/route.ts`
- ✅ API de actualización: `app/api/listings/update/route.ts`

### Estructura Actual:
```typescript
// En listings
size_variants: string[] | null  // Array de tallas disponibles
stock: number | null            // Stock general (no por talla)

// En cart_items
selected_size: string | null    // Talla seleccionada al agregar al carrito
```

**Limitación actual:** No hay stock individual por talla, solo stock general.

---

## REQUERIMIENTOS ESPECÍFICOS

### 1. TALLAS DE ROPA

#### A. Sistema de Tallas Predefinido
**Tallas disponibles:**
- SCH (Súper Chica)
- CH (Chica)
- M (Mediana)
- L (Grande)
- XL (Extra Grande)
- XXL (Doble Extra Grande)
- XXXL (Triple Extra Grande)
- XXXXL (Cuádruple Extra Grande)

#### B. Selector en Formulario de Publicación
**Ubicación:** `app/sell/page.tsx`

**Comportamiento:**
- Aparece cuando la categoría es de ropa (no calzado)
- Permite seleccionar múltiples tallas disponibles
- Muestra checkboxes o chips seleccionables
- Permite agregar stock individual por cada talla seleccionada

**Diseño:**
```
┌─────────────────────────────────────────┐
│ Tallas disponibles (Ropa) *             │
│                                         │
│ [✓] SCH  [✓] CH  [✓] M  [✓] L          │
│ [ ] XL   [ ] XXL [ ] XXXL [ ] XXXXL    │
│                                         │
│ Stock por talla:                        │
│ SCH: [5]  CH: [3]  M: [10]  L: [8]     │
│ XL:  [2]  XXL: [1]                      │
└─────────────────────────────────────────┘
```

### 2. TALLAS DE CALZADO

#### A. Sistema de Tallas Mexicano

**Calzado para Niños:**
- 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35

**Calzado para Hombres:**
- 24, 24.5, 25, 25.5, 26, 26.5, 27, 27.5, 28, 28.5, 29, 29.5, 30, 30.5, 31, 31.5, 32, 32.5, 33, 33.5, 34, 34.5, 35, 35.5, 36, 36.5, 37, 37.5, 38, 38.5, 39, 39.5, 40, 40.5, 41, 41.5, 42, 42.5, 43, 43.5, 44, 44.5, 45, 45.5, 46, 46.5, 47, 47.5, 48, 48.5, 49, 49.5, 50

**Calzado para Mujeres:**
- 20, 20.5, 21, 21.5, 22, 22.5, 23, 23.5, 24, 24.5, 25, 25.5, 26, 26.5, 27, 27.5, 28, 28.5, 29, 29.5, 30, 30.5, 31, 31.5, 32, 32.5, 33, 33.5, 34, 34.5, 35, 35.5, 36, 36.5, 37, 37.5, 38, 38.5, 39, 39.5, 40, 40.5, 41, 41.5, 42, 42.5, 43, 43.5, 44, 44.5, 45

**Calzado para Niñas:**
- 18, 19, 20, 20.5, 21, 21.5, 22, 22.5, 23, 23.5, 24, 24.5, 25, 25.5, 26, 26.5, 27, 27.5, 28, 28.5, 29, 29.5, 30, 30.5, 31, 31.5, 32, 32.5, 33, 33.5, 34, 34.5, 35, 35.5, 36, 36.5, 37, 37.5, 38, 38.5, 39, 39.5, 40

#### B. Selector Inteligente por Género
**Comportamiento:**
- Si categoría = "Calzado" → Mostrar selector de calzado
- El selector cambia según el género seleccionado:
  - Género "Niños" → Tallas de calzado para niños
  - Género "Hombre" → Tallas de calzado para hombres
  - Género "Mujer" → Tallas de calzado para mujeres
  - Género "Niñas" → Tallas de calzado para niñas

**Diseño:**
```
┌─────────────────────────────────────────┐
│ Tallas disponibles (Calzado) *         │
│ Género: [Mujer ▼]                      │
│                                         │
│ [✓] 20  [✓] 20.5  [✓] 21  [✓] 21.5    │
│ [✓] 22  [✓] 22.5  [✓] 23  [✓] 23.5    │
│ [ ] 24  [ ] 24.5  [ ] 25  [ ] 25.5    │
│ ... (scrollable)                       │
│                                         │
│ Stock por talla:                        │
│ 20: [3]  20.5: [5]  21: [2]  21.5: [4]│
│ 22: [1]  22.5: [6]                      │
└─────────────────────────────────────────┘
```

---

## 3. ESTRUCTURA DE BASE DE DATOS

### A. Modificar Tabla `listings`

**Agregar columna para stock por talla:**
```sql
-- Agregar columna para stock por talla (JSONB)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS size_stock JSONB NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.listings.size_stock IS 
  'Stock por talla: {"SCH": 5, "CH": 3, "M": 10, "L": 8, "XL": 2, "XXL": 1} o {"20": 3, "20.5": 5, "21": 2}';
```

**Estructura JSON:**
```json
// Para ropa
{
  "SCH": 5,
  "CH": 3,
  "M": 10,
  "L": 8,
  "XL": 2,
  "XXL": 1
}

// Para calzado
{
  "20": 3,
  "20.5": 5,
  "21": 2,
  "22": 1,
  "22.5": 6
}
```

### B. Agregar Columna de Tipo de Talla
```sql
-- Agregar columna para identificar tipo de talla
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS size_type TEXT NULL;

COMMENT ON COLUMN public.listings.size_type IS 
  'Tipo de talla: "clothing" (ropa) o "shoes" (calzado)';
```

**Valores posibles:**
- `"clothing"` - Ropa (SCH, CH, M, L, XL, etc.)
- `"shoes"` - Calzado (sistema mexicano)
- `null` - Sin tallas o talla única

---

## 4. COMPONENTES A CREAR/MODIFICAR

### A. Componente de Selector de Tallas de Ropa
**Archivo:** `components/listings/ClothingSizeSelector.tsx`

```typescript
'use client';

type ClothingSize = 'SCH' | 'CH' | 'M' | 'L' | 'XL' | 'XXL' | 'XXXL' | 'XXXXL';

interface ClothingSizeSelectorProps {
  selectedSizes: ClothingSize[];
  sizeStock: Record<ClothingSize, number>;
  onSizesChange: (sizes: ClothingSize[]) => void;
  onStockChange: (size: ClothingSize, stock: number) => void;
}

export function ClothingSizeSelector({
  selectedSizes,
  sizeStock,
  onSizesChange,
  onStockChange,
}: ClothingSizeSelectorProps) {
  const allSizes: ClothingSize[] = ['SCH', 'CH', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'];
  
  // Implementar UI con checkboxes y campos de stock
}
```

### B. Componente de Selector de Tallas de Calzado
**Archivo:** `components/listings/ShoeSizeSelector.tsx`

```typescript
'use client';

type Gender = 'Niños' | 'Hombre' | 'Mujer' | 'Niñas';

interface ShoeSizeSelectorProps {
  gender: Gender;
  selectedSizes: string[];
  sizeStock: Record<string, number>;
  onSizesChange: (sizes: string[]) => void;
  onStockChange: (size: string, stock: number) => void;
}

export function ShoeSizeSelector({
  gender,
  selectedSizes,
  sizeStock,
  onSizesChange,
  onStockChange,
}: ShoeSizeSelectorProps) {
  // Obtener tallas según género
  const getSizesForGender = (g: Gender): string[] => {
    // Retornar array de tallas según género
  };
  
  // Implementar UI con checkboxes y campos de stock
}
```

### C. Componente Unificado de Tallas
**Archivo:** `components/listings/SizeSelector.tsx`

```typescript
'use client';

interface SizeSelectorProps {
  category: string;
  gender: 'Mujer' | 'Hombre' | 'Niños' | 'Niñas' | 'Unisex';
  sizeType: 'clothing' | 'shoes' | null;
  selectedSizes: string[];
  sizeStock: Record<string, number>;
  onSizeTypeChange: (type: 'clothing' | 'shoes' | null) => void;
  onSizesChange: (sizes: string[]) => void;
  onStockChange: (size: string, stock: number) => void;
}

export function SizeSelector({ ... }: SizeSelectorProps) {
  // Detectar automáticamente si es calzado según categoría
  const isShoesCategory = category?.toLowerCase().includes('calzado') || 
                          category?.toLowerCase().includes('zapatos') ||
                          category?.toLowerCase().includes('zapatillas');
  
  // Renderizar ClothingSizeSelector o ShoeSizeSelector según corresponda
}
```

---

## 5. MODIFICACIONES EN FORMULARIO DE PUBLICACIÓN

### A. Archivo: `app/sell/page.tsx`

**Cambios requeridos:**

1. **Agregar estado para tipo de talla:**
```typescript
const [sizeType, setSizeType] = useState<'clothing' | 'shoes' | null>(null);
const [sizeStock, setSizeStock] = useState<Record<string, number>>({});
```

2. **Detectar automáticamente tipo de talla:**
```typescript
useEffect(() => {
  const isShoes = category?.toLowerCase().includes('calzado') || 
                  category?.toLowerCase().includes('zapatos');
  setSizeType(isShoes ? 'shoes' : category ? 'clothing' : null);
}, [category]);
```

3. **Reemplazar selector actual de tallas:**
```tsx
{/* Reemplazar el input de size_variants actual */}
<SizeSelector
  category={category}
  gender={gender}
  sizeType={sizeType}
  selectedSizes={sizeVariants}
  sizeStock={sizeStock}
  onSizeTypeChange={setSizeType}
  onSizesChange={setSizeVariants}
  onStockChange={(size, stock) => {
    setSizeStock(prev => ({ ...prev, [size]: stock }));
  }}
/>
```

4. **Enviar stock por talla al crear publicación:**
```typescript
const res = await fetch('/api/listings/create', {
  method: 'POST',
  body: JSON.stringify({
    // ... otros campos
    size_variants: sizeVariants.length > 0 ? sizeVariants : null,
    size_stock: Object.keys(sizeStock).length > 0 ? sizeStock : null,
    size_type: sizeType,
  }),
});
```

### B. Archivo: `app/dashboard/listings/[id]/edit/page.tsx`

**Aplicar los mismos cambios** para permitir editar tallas y stock por talla.

---

## 6. MODIFICACIONES EN PÁGINA DE PRODUCTO

### A. Archivo: `app/listings/[id]/page.tsx`

**Cambios requeridos:**

1. **Mostrar selector de tallas mejorado:**
```tsx
{(() => {
  const sizeVariants = normalizeArray(listing.size_variants);
  const sizeStock = listing.size_stock || {};
  const hasSizeVariants = sizeVariants && sizeVariants.length > 0;
  
  if (!hasSizeVariants) return null;
  
  return (
    <div className="rounded-2xl border border-black/5 bg-white px-4 py-3">
      <div className="text-xs font-medium text-gray-600">
        Talla {hasSizeVariants && <span className="text-red-500">*</span>}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {sizeVariants.map((size) => {
          const stock = sizeStock[size] ?? 0;
          const isOutOfStock = stock <= 0;
          const isSelected = selectedSize === size;
          
          return (
            <button
              key={size}
              type="button"
              onClick={() => !isOutOfStock && setSelectedSize(size)}
              disabled={isOutOfStock}
              className={`
                rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors
                ${isSelected 
                  ? 'border-brand-pink bg-pink-50 text-brand-pink' 
                  : isOutOfStock
                    ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 bg-white text-gray-900 hover:border-brand-pink hover:bg-pink-50'
                }
              `}
            >
              <div>{size}</div>
              {stock > 0 && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {stock} disponible{stock > 1 ? 's' : ''}
                </div>
              )}
              {isOutOfStock && (
                <div className="text-[10px] text-red-500 mt-0.5">Agotado</div>
              )}
            </button>
          );
        })}
      </div>
      {selectedSize && (
        <div className="mt-2 text-xs text-gray-600">
          Talla seleccionada: <span className="font-bold">{selectedSize}</span>
          {sizeStock[selectedSize] && (
            <span className="ml-2">
              ({sizeStock[selectedSize]} disponible{sizeStock[selectedSize] > 1 ? 's' : ''})
            </span>
          )}
        </div>
      )}
    </div>
  );
})()}
```

2. **Validar stock antes de agregar al carrito:**
```typescript
const addToCart = async () => {
  if (!selectedSize && hasSizeVariants) {
    setError('Por favor selecciona una talla');
    return;
  }
  
  if (selectedSize && sizeStock[selectedSize] <= 0) {
    setError('Esta talla está agotada');
    return;
  }
  
  // Continuar con agregar al carrito...
};
```

---

## 7. MODIFICACIONES EN API

### A. Archivo: `app/api/listings/create/route.ts`

**Cambios requeridos:**

1. **Aceptar `size_stock` y `size_type`:**
```typescript
type Body = {
  // ... campos existentes
  size_stock?: Record<string, number> | null;
  size_type?: 'clothing' | 'shoes' | null;
};
```

2. **Validar y guardar:**
```typescript
const payload: any = {
  // ... campos existentes
  size_variants: Array.isArray(body.size_variants) && body.size_variants.length > 0
    ? body.size_variants.filter((s: any) => typeof s === 'string' && s.trim()).map((s: string) => s.trim())
    : null,
  size_stock: body.size_stock && typeof body.size_stock === 'object'
    ? body.size_stock
    : null,
  size_type: body.size_type === 'clothing' || body.size_type === 'shoes'
    ? body.size_type
    : null,
};
```

### B. Archivo: `app/api/listings/update/route.ts`

**Aplicar los mismos cambios** para permitir actualizar stock por talla.

### C. Validación de Stock en Checkout
**Archivo:** `app/api/checkout/create/route.ts`

**Agregar validación:**
```typescript
// Antes de crear la orden, validar stock por talla
if (item.selected_size) {
  const listing = listingById[item.listingId];
  const sizeStock = listing.size_stock || {};
  const availableStock = sizeStock[item.selected_size] ?? 0;
  
  if (availableStock < item.quantity) {
    return NextResponse.json({
      error: `Solo hay ${availableStock} disponible(s) de la talla ${item.selected_size} para "${listing.title}"`
    }, { status: 400 });
  }
}
```

### D. Actualizar Stock al Comprar
**Archivo:** `app/api/checkout/create/route.ts` o `app/api/mercadopago/webhook/route.ts`

**Descontar stock:**
```typescript
// Después de confirmar pago, descontar stock por talla
if (orderItem.selected_size && listing.size_stock) {
  const currentStock = listing.size_stock[orderItem.selected_size] ?? 0;
  const newStock = Math.max(0, currentStock - orderItem.quantity);
  
  await admin
    .from('listings')
    .update({
      size_stock: {
        ...listing.size_stock,
        [orderItem.selected_size]: newStock
      }
    })
    .eq('id', listing.id);
}
```

---

## 8. CONSTANTES Y UTILIDADES

### A. Archivo: `lib/sizes/constants.ts`

```typescript
// Tallas de ropa
export const CLOTHING_SIZES = ['SCH', 'CH', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL'] as const;
export type ClothingSize = typeof CLOTHING_SIZES[number];

// Tallas de calzado por género
export const SHOE_SIZES_BY_GENDER: Record<string, string[]> = {
  'Niños': ['18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35'],
  'Hombre': ['24', '24.5', '25', '25.5', '26', '26.5', '27', '27.5', '28', '28.5', '29', '29.5', '30', '30.5', '31', '31.5', '32', '32.5', '33', '33.5', '34', '34.5', '35', '35.5', '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40', '40.5', '41', '41.5', '42', '42.5', '43', '43.5', '44', '44.5', '45', '45.5', '46', '46.5', '47', '47.5', '48', '48.5', '49', '49.5', '50'],
  'Mujer': ['20', '20.5', '21', '21.5', '22', '22.5', '23', '23.5', '24', '24.5', '25', '25.5', '26', '26.5', '27', '27.5', '28', '28.5', '29', '29.5', '30', '30.5', '31', '31.5', '32', '32.5', '33', '33.5', '34', '34.5', '35', '35.5', '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40', '40.5', '41', '41.5', '42', '42.5', '43', '43.5', '44', '44.5', '45'],
  'Niñas': ['18', '19', '20', '20.5', '21', '21.5', '22', '22.5', '23', '23.5', '24', '24.5', '25', '25.5', '26', '26.5', '27', '27.5', '28', '28.5', '29', '29.5', '30', '30.5', '31', '31.5', '32', '32.5', '33', '33.5', '34', '34.5', '35', '35.5', '36', '36.5', '37', '37.5', '38', '38.5', '39', '39.5', '40'],
};

export function getShoeSizesForGender(gender: string): string[] {
  return SHOE_SIZES_BY_GENDER[gender] || [];
}

export function isShoesCategory(category: string): boolean {
  const lower = category?.toLowerCase() || '';
  return lower.includes('calzado') || 
         lower.includes('zapatos') || 
         lower.includes('zapatillas') ||
         lower.includes('tenis') ||
         lower.includes('sneakers');
}
```

### B. Archivo: `lib/sizes/utils.ts`

```typescript
export function validateSizeStock(
  sizeStock: Record<string, number>,
  selectedSize: string,
  quantity: number
): { valid: boolean; available: number; error?: string } {
  if (!selectedSize) {
    return { valid: false, available: 0, error: 'Debes seleccionar una talla' };
  }
  
  const available = sizeStock[selectedSize] ?? 0;
  
  if (available <= 0) {
    return { valid: false, available: 0, error: 'Esta talla está agotada' };
  }
  
  if (available < quantity) {
    return { 
      valid: false, 
      available, 
      error: `Solo hay ${available} disponible(s) de esta talla` 
    };
  }
  
  return { valid: true, available };
}
```

---

## 9. SQL REQUERIDO

```sql
-- ============================================
-- Sistema de Tallas de Ropa y Calzado
-- Ejecuta este SQL en Supabase → SQL Editor
-- ============================================

-- 1. Agregar columna size_stock (stock por talla)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS size_stock JSONB NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.listings.size_stock IS 
  'Stock por talla en formato JSON: {"SCH": 5, "CH": 3, "M": 10} para ropa o {"20": 3, "20.5": 5} para calzado';

-- 2. Agregar columna size_type (tipo de talla)
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS size_type TEXT NULL;

COMMENT ON COLUMN public.listings.size_type IS 
  'Tipo de talla: "clothing" (ropa) o "shoes" (calzado). NULL si no aplica.';

-- 3. Índice para búsquedas por tipo de talla (opcional)
CREATE INDEX IF NOT EXISTS listings_size_type_idx 
  ON public.listings (size_type) 
  WHERE size_type IS NOT NULL;

-- 4. Función para validar que size_stock coincida con size_variants
CREATE OR REPLACE FUNCTION validate_size_stock_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Si hay size_variants, verificar que size_stock tenga entradas para todas
  IF NEW.size_variants IS NOT NULL 
     AND array_length(NEW.size_variants, 1) > 0 
     AND NEW.size_stock IS NOT NULL THEN
    -- Verificar que todas las tallas en size_variants tengan entrada en size_stock
    -- (esto es una validación opcional, se puede hacer en el backend)
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger para validación (opcional)
DROP TRIGGER IF EXISTS trg_validate_size_stock ON public.listings;
CREATE TRIGGER trg_validate_size_stock
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION validate_size_stock_consistency();

-- 6. Asegurar que cart_items.selected_size existe (ya debería existir)
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS selected_size TEXT NULL;

-- 7. Asegurar que order_items.selected_size existe (para historial)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS selected_size TEXT NULL;

COMMENT ON COLUMN public.order_items.selected_size IS 
  'Talla seleccionada al momento de la compra (snapshot para historial)';
```

---

## 10. FLUJO COMPLETO DE USO

### A. Vendedor Crea Publicación

1. **Selecciona categoría:**
   - Si es "Ropa" → Aparece selector de tallas de ropa
   - Si es "Calzado" → Aparece selector de tallas de calzado (según género)

2. **Selecciona tallas disponibles:**
   - Marca checkboxes de tallas que tiene en stock
   - Ingresa cantidad disponible para cada talla

3. **Publica:**
   - Sistema guarda `size_variants` (array de tallas)
   - Sistema guarda `size_stock` (JSON con stock por talla)
   - Sistema guarda `size_type` ("clothing" o "shoes")

### B. Comprador Ve Producto

1. **Ve selector de tallas:**
   - Grid de botones con tallas disponibles
   - Muestra stock disponible por talla
   - Tallas agotadas aparecen deshabilitadas

2. **Selecciona talla:**
   - Click en botón de talla
   - Se resalta la talla seleccionada
   - Muestra stock disponible

3. **Agrega al carrito:**
   - Validación: debe seleccionar talla si hay variantes
   - Validación: debe haber stock disponible
   - Se guarda `selected_size` en `cart_items`

### C. Comprador Compra

1. **En checkout:**
   - Muestra talla seleccionada para cada item
   - Valida stock antes de procesar pago

2. **Al confirmar pago:**
   - Se descuenta stock de la talla correspondiente
   - Se guarda `selected_size` en `order_items` (snapshot)

---

## 11. MEJORAS DE UX

### A. Indicadores Visuales

- **Talla disponible:** Botón normal, muestra stock
- **Talla agotada:** Botón gris, texto "Agotado", deshabilitado
- **Talla seleccionada:** Borde rosa, fondo rosa claro
- **Stock bajo (≤3):** Badge amarillo "Pocas unidades"

### B. Mensajes de Ayuda

- **En selector de tallas:** "Selecciona las tallas que tienes disponibles"
- **En stock:** "Ingresa la cantidad disponible para cada talla"
- **En producto:** "Selecciona tu talla antes de agregar al carrito"

### C. Validaciones

- **Al publicar:** Al menos una talla debe tener stock > 0
- **Al comprar:** Validar stock antes de procesar
- **En carrito:** Mostrar advertencia si stock cambió

---

## 12. ARCHIVOS A CREAR/MODIFICAR

### Nuevos Archivos:
1. `lib/sizes/constants.ts` - Constantes de tallas
2. `lib/sizes/utils.ts` - Utilidades de validación
3. `components/listings/ClothingSizeSelector.tsx` - Selector de ropa
4. `components/listings/ShoeSizeSelector.tsx` - Selector de calzado
5. `components/listings/SizeSelector.tsx` - Selector unificado

### Archivos a Modificar:
1. `app/sell/page.tsx` - Formulario de publicación
2. `app/dashboard/listings/[id]/edit/page.tsx` - Edición de publicación
3. `app/listings/[id]/page.tsx` - Página de producto
4. `app/api/listings/create/route.ts` - API de creación
5. `app/api/listings/update/route.ts` - API de actualización
6. `app/api/checkout/create/route.ts` - Validación de stock
7. `app/api/mercadopago/webhook/route.ts` - Descontar stock al pagar
8. `app/checkout/page.tsx` - Mostrar tallas en checkout

---

## 13. CHECKLIST DE IMPLEMENTACIÓN

### Base de Datos:
- [ ] Agregar columna `size_stock` (JSONB)
- [ ] Agregar columna `size_type` (TEXT)
- [ ] Agregar columna `selected_size` a `order_items` (si no existe)
- [ ] Crear índices necesarios

### Constantes y Utilidades:
- [ ] Crear `lib/sizes/constants.ts` con tallas predefinidas
- [ ] Crear `lib/sizes/utils.ts` con funciones de validación

### Componentes:
- [ ] Crear `ClothingSizeSelector.tsx`
- [ ] Crear `ShoeSizeSelector.tsx`
- [ ] Crear `SizeSelector.tsx` (unificado)

### Formularios:
- [ ] Modificar `app/sell/page.tsx` para usar nuevos selectores
- [ ] Modificar `app/dashboard/listings/[id]/edit/page.tsx` para editar tallas

### Página de Producto:
- [ ] Mejorar selector de tallas en `app/listings/[id]/page.tsx`
- [ ] Agregar validación de stock antes de agregar al carrito
- [ ] Mostrar indicadores visuales (disponible/agotado)

### APIs:
- [ ] Modificar `app/api/listings/create/route.ts` para aceptar `size_stock` y `size_type`
- [ ] Modificar `app/api/listings/update/route.ts` para actualizar stock
- [ ] Agregar validación de stock en `app/api/checkout/create/route.ts`
- [ ] Descontar stock en webhook de MercadoPago

### Testing:
- [ ] Probar creación de publicación con tallas de ropa
- [ ] Probar creación de publicación con tallas de calzado
- [ ] Probar selección de talla en producto
- [ ] Probar validación de stock al comprar
- [ ] Probar descuento de stock al confirmar pago

---

## 14. EJEMPLOS DE USO

### Ejemplo 1: Publicación de Ropa
```
Categoría: "Tops"
Género: "Mujer"
Tallas disponibles: [✓] CH, [✓] M, [✓] L, [✓] XL
Stock:
  - CH: 5 unidades
  - M: 10 unidades
  - L: 8 unidades
  - XL: 3 unidades
```

### Ejemplo 2: Publicación de Calzado
```
Categoría: "Calzado"
Género: "Mujer"
Tallas disponibles: [✓] 22, [✓] 22.5, [✓] 23, [✓] 23.5, [✓] 24
Stock:
  - 22: 2 pares
  - 22.5: 4 pares
  - 23: 1 par
  - 23.5: 3 pares
  - 24: 5 pares
```

---

## 15. CONSIDERACIONES ADICIONALES

### A. Migración de Datos Existentes
Si hay publicaciones existentes con `size_variants` pero sin `size_stock`:
- Opción 1: Usar `stock` general como stock para todas las tallas
- Opción 2: Pedir al vendedor que actualice stock por talla
- Opción 3: Asignar stock igual a todas las tallas (stock / cantidad de tallas)

### B. Búsqueda y Filtros
**Futuro:** Agregar filtros por talla en búsqueda de productos:
- "Mostrar solo productos disponibles en talla M"
- "Filtrar calzado por talla 23"

### C. Notificaciones
**Futuro:** Notificar al vendedor cuando una talla se agote:
- "La talla M de '[producto]' se agotó"

### D. Reportes
**Futuro:** Dashboard de ventas por talla:
- "Talla más vendida: M (45 ventas)"
- "Talla con más stock: XL (120 unidades)"

---

## NOTAS FINALES

- **Prioridad:** Implementar primero el selector básico, luego stock por talla
- **Compatibilidad:** Mantener compatibilidad con publicaciones sin tallas
- **UX:** Hacer el selector intuitivo y visualmente claro
- **Validación:** Validar stock en múltiples puntos (carrito, checkout, pago)

---

**Este prompt debe ser ejecutado por un agente de IA o desarrollador para implementar el sistema completo de tallas de ropa y calzado.**
