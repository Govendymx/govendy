import type { TemplateBlock } from '@/lib/templates/blocks';
import { parseSizeStock } from '@/lib/cart/availability';
import { NEW_CATEGORIES_CONFIG } from '@/lib/categories';

export function resolveSubcategoryLabel(
  gender: string,
  categoryLabel: string,
  subcategoryId: string,
): string {
  if (!subcategoryId) return '';
  const cats = NEW_CATEGORIES_CONFIG[gender] || [];
  const cat = cats.find(
    (c) =>
      c.label === categoryLabel ||
      c.id === categoryLabel ||
      c.label.toLowerCase() === categoryLabel.toLowerCase(),
  );
  const sub = cat?.subcategories?.find(
    (s) =>
      s.id === subcategoryId ||
      s.label === subcategoryId ||
      s.label.toLowerCase() === subcategoryId.toLowerCase(),
  );
  return sub?.label || subcategoryId;
}

/** Ruta legible: Género › Categoría › Subcategoría */
export function buildSavedCategoryPath(
  gender: string,
  category: string,
  subcategory?: string | null,
): string[] {
  const parts: string[] = [];
  if (gender) parts.push(gender);
  if (category) parts.push(category);
  if (subcategory) {
    parts.push(resolveSubcategoryLabel(gender, category, subcategory));
  }
  return parts;
}

/** Parsea arrays guardados como JSON string u objeto. */
export function parseStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === 'string' ? v.trim() : String(v).trim()))
      .filter((v) => v.length > 0);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((v) => String(v).trim())
          .filter((v) => v.length > 0);
      }
    } catch {
      return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function parseDescriptionBlocks(value: unknown): TemplateBlock[] {
  if (!value) return [];
  let raw: unknown = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as TemplateBlock[]) : [];
}

/** Alinea stock por talla con las variantes seleccionadas (números, no strings). */
export function alignSizeStockWithVariants(
  variants: string[],
  rawStock: unknown,
): Record<string, number> {
  const parsed = parseSizeStock(rawStock) || {};
  if (variants.length === 0) return parsed;

  const out: Record<string, number> = {};
  const hasParsedValues = Object.keys(parsed).length > 0;

  for (const size of variants) {
    let n: number | undefined;
    if (parsed[size] !== undefined) {
      n = Number(parsed[size]);
    } else {
      const key = Object.keys(parsed).find(
        (k) => k.trim().toUpperCase() === size.trim().toUpperCase(),
      );
      if (key !== undefined) n = Number(parsed[key]);
    }
    if (Number.isFinite(n) && n >= 0) {
      out[size] = n;
    } else if (!hasParsedValues) {
      out[size] = 1;
    } else {
      out[size] = 0;
    }
  }
  return out;
}

export function getDescriptionModeForForm(
  mode: 'create' | 'edit' | 'clone',
  blocks: TemplateBlock[] | null | undefined,
): 'richtext' | 'blocks' {
  if (mode === 'edit') return 'richtext';
  if (!blocks?.length) return 'richtext';
  const onlyRichtext = blocks.every((b) => b.type === 'richtext');
  return onlyRichtext ? 'richtext' : 'blocks';
}

/** Normaliza fila de BD o partial del formulario para hidratar el editor. */
export function normalizeListingFormInitialData(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!data) return {};

  const sizeVariants = parseStringArray(data.size_variants);
  const colorVariants = parseStringArray(data.color_variants);
  const descriptionBlocks = parseDescriptionBlocks(data.description_blocks);
  const sizeStock = alignSizeStockWithVariants(sizeVariants, data.size_stock);

  const sizeTypeRaw = data.size_type;
  const sizeType: 'clothing' | 'shoes' =
    sizeTypeRaw === 'shoes' ? 'shoes' : 'clothing';

  let attributes = data.attributes;
  if (typeof attributes === 'string') {
    try {
      attributes = JSON.parse(attributes);
    } catch {
      attributes = {};
    }
  }
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    attributes = {};
  }
  const attrs = attributes as Record<string, unknown>;

  const brand =
    (typeof data.brand === 'string' && data.brand.trim()) ||
    (typeof attrs.brand === 'string' && attrs.brand.trim()) ||
    '';
  const model =
    (typeof data.model === 'string' && data.model.trim()) ||
    (typeof attrs.model === 'string' && attrs.model.trim()) ||
    '';
  const color =
    (typeof data.color === 'string' && data.color.trim()) ||
    (typeof attrs.color === 'string' && attrs.color.trim()) ||
    '';

  let wholesaleTiers = data.wholesale_tiers;
  if (typeof wholesaleTiers === 'string') {
    try {
      wholesaleTiers = JSON.parse(wholesaleTiers);
    } catch {
      wholesaleTiers = [];
    }
  }

  let digitalFields = data.digital_delivery_fields;
  if (typeof digitalFields === 'string') {
    try {
      digitalFields = JSON.parse(digitalFields);
    } catch {
      digitalFields = undefined;
    }
  }

  let images = data.images;
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch {
      images = [];
    }
  }

  return {
    ...data,
    title: data.title ?? '',
    description: data.description ?? '',
    price: data.price != null ? String(data.price) : '',
    stock: data.stock != null ? String(data.stock) : '1',
    gender: data.gender ?? 'Mujer',
    size: data.size ?? '',
    brand,
    model,
    color,
    category: data.category ?? '',
    subcategory: data.subcategory ?? '',
    images: Array.isArray(images) ? images : [],
    description_blocks: descriptionBlocks,
    color_variants: colorVariants,
    size_variants: sizeVariants,
    size_stock: sizeStock,
    size_type: sizeType,
    attributes: attributes as Record<string, unknown>,
    tags: parseStringArray(data.tags),
    wholesale_tiers: Array.isArray(wholesaleTiers) ? wholesaleTiers : [],
    digital_delivery_fields: Array.isArray(digitalFields) ? digitalFields : undefined,
  };
}
