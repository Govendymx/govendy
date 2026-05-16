'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { TemplateBlock } from '@/lib/templates/blocks';
import { blocksToPlainText } from '@/lib/templates/text';
import { BlocksRenderer } from '@/components/templates/BlocksRenderer';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { listingPolicyHumanWarning, scanListingContentPolicy } from '@/lib/moderation/listingContentPolicy';
import { checkLimit, getPlan, PLAN_LIMITS, PlanType, getCommissions } from '@/lib/plans/limits';
import { mergeFeatureFlags } from '@/lib/admin/feature-flags';
import { NEW_CATEGORIES_CONFIG, generateTags, UNIVERSAL_ATTRIBUTES, IS_FASHION_ROOT, type Category, type SubCategory, type AttributeConfig } from '@/lib/categories';
import ImageUploader from '@/components/listings/ImageUploader';
import { SmartCategorySelector } from '@/components/listings/SmartCategorySelector';
import { MLCategorySelector } from '@/components/listings/MLCategorySelector';
import { detectCategory } from '@/lib/category-detection';
import { useDomainDiscovery, type DomainSuggestion } from '@/lib/hooks/useDomainDiscovery';
import { mapMlSuggestionToLocal } from '@/lib/meli/mapMlSuggestionToLocal';
import { useMeliAttributes, type MeliAttribute, type MeliAttributeGroup } from '@/lib/hooks/useMeliAttributes';
import { taskQueue } from '@/lib/queue/TaskQueue';
import { PublicationAssistantPocky } from '@/components/mascot/PublicationAssistantPocky';
import { ProExpirationBanner } from '@/components/dashboard/ProExpirationBanner';
import { SizeVariantSelector } from '@/components/listings/SizeVariantSelector';
import { ColorVariantManager } from '@/components/listings/ColorVariantManager';
import { TemplateSelector } from './TemplateSelector';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import { WholesaleTierEditor, type WholesaleTier } from '@/components/listings/WholesaleTierEditor';
import { detectClothingType, DiagramForType, type CustomSizeChart } from '@/components/listings/ClothingSizeChart';

// Tipos auxiliares para el formulario
export type ListingFormMode = 'create' | 'edit' | 'clone';

export interface ListingFormData {
  id?: string;
  title: string;
  description: string;
  price: string;
  gender: string;
  size: string;
  brand: string;
  model: string;
  color: string;
  category: string;
  subcategory?: string;
  status: 'draft' | 'active' | 'paused' | 'sold' | 'blocked';
  sale_type: 'direct' | 'auction';
  condition: 'nuevo' | 'usado' | 'casi_nuevo' | null;
  stock: string;
  images: string[]; // URLs existentes
  description_blocks?: TemplateBlock[] | null;

  // Producto Digital
  product_type: 'physical' | 'digital';
  digital_delivery_type?: 'manual' | null;
  digital_delivery_fields?: { label: string }[];

  // Subasta
  auction_start_at?: string;
  auction_end_at?: string;
  auction_starting_bid?: string;
  auction_bid_increment?: string;

  // Envío
  free_shipping: boolean;
  shipping_subsidy?: string;
  weight_kg: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  shipping_by_seller: boolean;
  allow_personal_delivery: boolean;
  handling_days: string;
  custom_shipping_price?: string;
  shipping_carrier?: string;

  // Variantes
  color_variants?: string[];
  size_variants?: string[];
  size_stock?: Record<string, number>;
  size_type?: 'clothing' | 'shoes';

  // Meta
  attributes: Record<string, any>;
  tags: string[];
  is_featured: boolean;
  wholesale_tiers?: WholesaleTier[] | null;

  // Video
  youtube_url?: string;
}

interface ListingFormProps {
  mode: ListingFormMode;
  initialData?: Partial<ListingFormData>;
  listingId?: string; // Para edit/clone
}

type UploadResult = { url: string };

function getFriendlyErrorMessage(err: unknown) {
  const msg =
    err instanceof Error
      ? err.message
      : typeof (err as any)?.message === 'string'
        ? String((err as any).message)
        : '';

  if (msg.toLowerCase().includes('failed to fetch')) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const urlHint =
      url && url.startsWith('http://') && url.includes('.supabase.co')
        ? `\n\nTu URL parece ser http://... (debe ser https://...).`
        : '';

    return (
      'No se pudo conectar con Supabase (Failed to fetch). ' +
      'Esto casi siempre es por URL/keys mal configuradas o por bloqueo de red.\n\n' +
      'Revisa en `.env.local`:\n' +
      '- NEXT_PUBLIC_SUPABASE_URL = https://<tu-proyecto>.supabase.co\n' +
      '- NEXT_PUBLIC_SUPABASE_ANON_KEY = <tu anon key>\n\n' +
      'Luego reinicia `npm run dev`.' +
      urlHint
    );
  }

  const base = msg || (err instanceof Error ? err.message : 'No se pudo iniciar la página de venta.');
  return base;
}

function formatMoney(value: number) {
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function isValidTimeHHmm(v: string) {
  return /^\d{2}:\d{2}$/.test(v);
}

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    body: fd,
    signal: controller.signal,
  }).catch((e: any) => {
    if (String(e?.name || '').toLowerCase().includes('abort')) {
      throw new Error('La subida de imágenes tardó demasiado. Intenta de nuevo con fotos más ligeras.');
    }
    throw e;
  });
  clearTimeout(timeout);
  const json = (await res.json().catch(() => ({}))) as Partial<UploadResult> & { error?: string };
  if (!res.ok) throw new Error(json?.error || 'No se pudo subir la imagen.');
  if (!json?.url) throw new Error('Respuesta inválida del servidor de upload.');
  return json.url;
}

export default function ListingForm({ mode, initialData, listingId }: ListingFormProps) {
  const isEdit = mode === 'edit';
  const isClone = mode === 'clone';
  const isCreate = mode === 'create';

  const [pageError, setPageError] = useState<string | null>(null);
  const [commissionRates, setCommissionRates] = useState<{ basic: number; pro: number; platinum: number } | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Estados del formulario
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [richTextContent, setRichTextContent] = useState('');
  const [priceInput, setPriceInput] = useState<string>(initialData?.price || '');
  const [gender, setGender] = useState<string>(initialData?.gender || 'Mujer');
  const [category, setCategory] = useState<string>(initialData?.category || '');
  const [subcategory, setSubcategory] = useState<string>(initialData?.subcategory || '');
  const [brand, setBrand] = useState<string>(initialData?.brand || '');
  const [model, setModel] = useState<string>(initialData?.model || '');
  const [color, setColor] = useState<string>(initialData?.color || '');
  const [condition, setCondition] = useState<'nuevo' | 'usado' | 'casi_nuevo' | null>(initialData?.condition || null);
  const [stock, setStock] = useState<string>(initialData?.stock || '');

  // Variantes
  const [colorVariants, setColorVariants] = useState<string[]>(initialData?.color_variants || []);
  const [newColorVariant, setNewColorVariant] = useState<string>('');
  const [sizeVariants, setSizeVariants] = useState<string[]>(initialData?.size_variants || []);
  const [newSizeVariant, setNewSizeVariant] = useState<string>('');
  const [sizeType, setSizeType] = useState<'clothing' | 'shoes'>(initialData?.size_type || 'clothing');
  const [sizeStock, setSizeStock] = useState<Record<string, number>>(initialData?.size_stock || {});

  // Guía de Tallas personalizada del vendedor
  const [customSizeChart, setCustomSizeChart] = useState<CustomSizeChart | null>(
    (initialData?.attributes as any)?.custom_size_chart ?? null
  );
  const [showSizeChartEditor, setShowSizeChartEditor] = useState(
    Boolean((initialData?.attributes as any)?.custom_size_chart)
  );

  // Atributos y Tags
  const [attributes, setAttributes] = useState<Record<string, any>>(initialData?.attributes || {});
  const [disabledAttributes, setDisabledAttributes] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [newTag, setNewTag] = useState('');

  // Imágenes
  const [existingImages, setExistingImages] = useState<string[]>(initialData?.images || []);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Configuración de Venta
  const [saleType, setSaleType] = useState<'direct' | 'auction'>(initialData?.sale_type || 'direct');
  const [isFeatured, setIsFeatured] = useState(initialData?.is_featured || false);

  // Producto Digital
  const [productType, setProductType] = useState<'physical' | 'digital'>((initialData as any)?.product_type || 'physical');
  const isDigital = productType === 'digital';
  const [digitalDeliveryFields, setDigitalDeliveryFields] = useState<{ label: string }[]>(
    ((initialData as any)?.digital_delivery_fields as { label: string }[]) || [{ label: 'Serial' }]
  );
  const [newFieldLabel, setNewFieldLabel] = useState('');

  // Mayoreo
  const [wholesaleTiers, setWholesaleTiers] = useState<WholesaleTier[]>(
    (initialData?.wholesale_tiers as WholesaleTier[]) || []
  );
  const [showWholesaleEditor, setShowWholesaleEditor] = useState(
    Array.isArray(initialData?.wholesale_tiers) && (initialData?.wholesale_tiers?.length ?? 0) > 0
  );

  // Envío
  const [freeShipping, setFreeShipping] = useState(initialData?.free_shipping || false);
  const [customShippingPrice, setCustomShippingPrice] = useState<string>(initialData?.custom_shipping_price || '');
  const [selectedShippingCarrier, setSelectedShippingCarrier] = useState<string>(initialData?.shipping_carrier || '');
  const [shippingSubsidy, setShippingSubsidy] = useState<string>(initialData?.shipping_subsidy || '');
  const [weight, setWeight] = useState<string>(initialData?.weight_kg || '1');
  const [length, setLength] = useState<string>(initialData?.length_cm || '20');
  const [width, setWidth] = useState<string>(initialData?.width_cm || '20');
  const [height, setHeight] = useState<string>(initialData?.height_cm || '20');
  const [shippingBySeller, setShippingBySeller] = useState(initialData?.shipping_by_seller || false);
  const [gopocketFlagReady, setGopocketFlagReady] = useState(false);
  const [gopocketShippingEnabled, setGopocketShippingEnabled] = useState(true);
  const [allowPersonalDelivery, setAllowPersonalDelivery] = useState(initialData?.allow_personal_delivery || false);
  const [handlingDays, setHandlingDays] = useState<string>(initialData?.handling_days || '3');

  // Video YouTube
  const [youtubeUrl, setYoutubeUrl] = useState<string>((initialData as any)?.youtube_url || '');

  // Plantillas UI
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [descriptionMode, setDescriptionMode] = useState<'richtext' | 'blocks'>(
    initialData?.description_blocks && Array.isArray(initialData.description_blocks) && initialData.description_blocks.length > 0 ? 'blocks' : 'richtext'
  );

  const [shippingCost, setShippingCost] = useState<number | null>(null);
  const [volumetricWeight, setVolumetricWeight] = useState<number>(0);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);

  // Subasta
  const [auctionStartDateTime, setAuctionStartDateTime] = useState<string>(
    initialData?.auction_start_at ? new Date(initialData.auction_start_at).toISOString().slice(0, 16) : ''
  );
  const [auctionEndDateTime, setAuctionEndDateTime] = useState<string>(
    initialData?.auction_end_at ? new Date(initialData.auction_end_at).toISOString().slice(0, 16) : ''
  );
  const [auctionStartingBidInput, setAuctionStartingBidInput] = useState<string>(initialData?.auction_starting_bid || '');
  const [auctionBidIncrementInput, setAuctionBidIncrementInput] = useState<string>(initialData?.auction_bid_increment || '10');

  // --- Auction Duration Logic ---
  // Helper: format local date as YYYY-MM-DD
  const formatLocalDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  // Helper: format local time as HH:MM
  const formatLocalTime = (d: Date) => {
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  };

  const [auctionStartDate, setAuctionStartDate] = useState<string>(() => {
    if (initialData?.auction_start_at) {
      return formatLocalDate(new Date(initialData.auction_start_at));
    }
    return formatLocalDate(new Date()); // Default: TODAY
  });
  const [auctionStartTime, setAuctionStartTime] = useState<string>(() => {
    if (initialData?.auction_start_at) {
      return formatLocalTime(new Date(initialData.auction_start_at));
    }
    return formatLocalTime(new Date()); // Default: NOW
  });
  const [auctionDurationHours, setAuctionDurationHours] = useState<number>(() => {
    if (initialData?.auction_start_at && initialData?.auction_end_at) {
      const start = new Date(initialData.auction_start_at).getTime();
      const end = new Date(initialData.auction_end_at).getTime();
      const diffHours = Math.round((end - start) / (1000 * 60 * 60));
      return diffHours > 0 ? diffHours : 1;
    }
    return 1;
  }); // Default 1 hour

  // Calculate auction_end_at based on Start + Duration
  useEffect(() => {
    if (!auctionStartDate || !auctionStartTime) return;

    // Create start date object
    const startStr = `${auctionStartDate}T${auctionStartTime}:00`;
    const start = new Date(startStr);

    if (isNaN(start.getTime())) return;

    setAuctionStartDateTime(start.toISOString());

    // Calculate end date
    const end = new Date(start.getTime() + auctionDurationHours * 60 * 60 * 1000);
    setAuctionEndDateTime(end.toISOString());
  }, [auctionStartDate, auctionStartTime, auctionDurationHours]);

  // Efecto para calcular envío mediante API Estafeta
  // SIEMPRE calcular cuando usa envíos GoVendy (incluso con envío gratis, para validar que el precio cubra el envío)
  const needsShippingCalc = gopocketFlagReady && gopocketShippingEnabled && !shippingBySeller;
  useEffect(() => {
    if (!needsShippingCalc) return;

    const w = Number(weight);
    const l = Number(length);
    const wd = Number(width);
    const h = Number(height);

    if (w > 0 && l > 0 && wd > 0 && h > 0) {
      const handler = setTimeout(async () => {
        try {
          setIsCalculatingShipping(true);
          const { data: session } = await supabase.auth.getSession();
          const token = session.session?.access_token;

          const res = await fetch('/api/estafeta/calculate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              weight_kg: w,
              length_cm: l,
              width_cm: wd,
              height_cm: h
            })
          });

          const json = await res.json();
          if (json.ok) {
            setShippingCost(json.cost);
            setVolumetricWeight(json.volumetric_weight);
          } else {
            setShippingCost(null);
            console.error('Error calculando envío:', json.error);
          }
        } catch (err) {
          console.error(err);
          setShippingCost(null);
        } finally {
          setIsCalculatingShipping(false);
        }
      }, 800);

      return () => clearTimeout(handler);
    }
  }, [weight, length, width, height, freeShipping, shippingBySeller, saleType, needsShippingCalc]);

  // Templates
  const [descriptionBlocks, setDescriptionBlocks] = useState<TemplateBlock[] | null>(initialData?.description_blocks || null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedTemplateTitle, setSelectedTemplateTitle] = useState<string>('');

  // Estado UI
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-detection control
  const isAutoDetecting = useRef(false);
  const [autoDetectionEnabled, setAutoDetectionEnabled] = useState(mode === 'create');
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [approvedCategories, setApprovedCategories] = useState<string[]>([]);
  const [mlCategoryId, setMlCategoryId] = useState<string | null>(
    (initialData?.attributes as any)?.ml_category_id || null
  );
  const [manualSearchTitle, setManualSearchTitle] = useState<string>('');

  // Domain Discovery: async category suggestion from title
  // Use manualSearchTitle if user searched, else use the listing title
  const effectiveSearchTitle = manualSearchTitle || title;
  const { topSuggestion: domainSuggestion, suggestions: allDomainSuggestions, isLoading: isDomainLoading } = useDomainDiscovery(effectiveSearchTitle, autoDetectionEnabled);

  // ML category attributes: dynamic fields based on ML category
  const { groups: meliAttrGroups, isLoading: isMeliAttrsLoading } = useMeliAttributes(mlCategoryId, !!mlCategoryId);
  const [meliAttrValues, setMeliAttrValues] = useState<Record<string, string>>(() => {
    const saved = (initialData?.attributes as any)?.ml_attributes;
    if (saved && typeof saved === 'object') {
      const restored: Record<string, string> = {};
      for (const [attrId, info] of Object.entries(saved as Record<string, any>)) {
        if (info && typeof info === 'object' && 'value' in info) {
          restored[attrId] = String(info.value);
        } else if (typeof info === 'string') {
          restored[attrId] = info;
        }
      }
      return restored;
    }
    return {};
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Plan limits
  const [limitsUsage, setLimitsUsage] = useState<{
    auctions: { allowed: boolean; usage: number; limit: number };
    listings: { allowed: boolean; usage: number; limit: number };
    featured: { allowed: boolean; usage: number; limit: number };
    plan: PlanType;
  } | null>(null);

  useEffect(() => {
    getCommissions(supabase).then(setCommissionRates);

    // Cargar categorías aprobadas
    supabase.from('categories').select('name').eq('is_approved', true)
      .then(({ data }) => {
        if (data) setApprovedCategories(data.map(c => c.name));
      });

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('profiles').select('*').eq('id', data.user.id).single()
          .then(({ data: profile }) => setUserProfile(profile));

        Promise.all([
          checkLimit(supabase, data.user.id, 'auctions'),
          checkLimit(supabase, data.user.id, 'listings'),
          checkLimit(supabase, data.user.id, 'featured'),
        ]).then(async ([auctions, listings, featured]) => {
          setLimitsUsage({
            auctions,
            listings,
            featured,
            plan: auctions.plan,
          });

          try {
            const { data: settingsRow } = await supabase.from('app_settings').select('feature_flags').eq('id', 1).maybeSingle();
            const gf = mergeFeatureFlags(settingsRow?.feature_flags);
            setGopocketShippingEnabled(gf.gopocket_shipping);
            setGopocketFlagReady(true);
            if (!gf.gopocket_shipping) {
              setShippingBySeller(true);
            } else if (!PLAN_LIMITS[auctions.plan].allow_shipping_by_seller && !isEdit) {
              setShippingBySeller(false);
            }
          } catch {
            setGopocketShippingEnabled(true);
            setGopocketFlagReady(true);
            if (!PLAN_LIMITS[auctions.plan].allow_shipping_by_seller && !isEdit) {
              setShippingBySeller(false);
            }
          }

          if (!PLAN_LIMITS[auctions.plan].allow_personal_delivery && !isEdit) {
            setAllowPersonalDelivery(false);
          }
        });
      } else {
        setGopocketFlagReady(true);
      }
    });
  }, [isEdit]);

  useEffect(() => {
    if (initialData?.description_blocks) {
      const rtBlock = initialData.description_blocks.find((b: any) => b.type === 'richtext') as any;
      if (rtBlock && rtBlock.content) {
        setRichTextContent(rtBlock.content);
      }
    } else if (description && !richTextContent) {
      setRichTextContent(description.replace(/\n/g, '<br>'));
    }
  }, [initialData?.description_blocks, description]);

  const onSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
      const newUrls = newFiles.map((f) => URL.createObjectURL(f));
      setPreviewUrls((prev) => [...prev, ...newUrls]);
    }
  };

  const removeFileAt = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExistingImageAt = (index: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRteChange = (html: string) => {
    setRichTextContent(html);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const plain = doc.body.textContent || '';
    setDescription(plain);
    if (!selectedTemplateId) {
      setDescriptionBlocks([{ type: 'richtext', content: html }]);
    }
  };

  const categories = useMemo(() => {
    const cats = NEW_CATEGORIES_CONFIG[gender] || [];
    const defaults = cats.map(c => c.label);
    return Array.from(new Set([...defaults, ...pendingCategories, ...approvedCategories]));
  }, [gender, pendingCategories, approvedCategories]);

  const currentCategoryConfig = useMemo(() => {
    const cats = NEW_CATEGORIES_CONFIG[gender] || [];
    return cats.find(c => c.label === category);
  }, [gender, category]);

  const currentSubcategoryConfig = useMemo(() => {
    if (!currentCategoryConfig || !subcategory) return null;
    return currentCategoryConfig.subcategories?.find(s => s.id === subcategory);
  }, [currentCategoryConfig, subcategory]);

  const activeAttributes = useMemo(() => {
    const catAttrs = currentCategoryConfig?.attributes || [];
    const subAttrs = currentSubcategoryConfig?.attributes || [];
    const attrMap = new Map<string, AttributeConfig>();
    UNIVERSAL_ATTRIBUTES.forEach(attr => attrMap.set(attr.id, attr));
    catAttrs.forEach(attr => attrMap.set(attr.id, attr));
    subAttrs.forEach(attr => attrMap.set(attr.id, attr));

    // Solo devolvemos atributos que NO sean los campos "primarios" (brand, model, color, condition)
    const primaryFields = ['brand', 'model', 'color', 'condition', 'gender'];
    return Array.from(attrMap.values()).filter(attr => !primaryFields.includes(attr.id));
  }, [currentCategoryConfig, currentSubcategoryConfig]);

  // Helper para saber si un campo primario es relevante para la categoría actual
  const isFieldRelevant = (fieldId: string) => {
    const catAttrs = currentCategoryConfig?.attributes || [];
    const subAttrs = currentSubcategoryConfig?.attributes || [];
    const allRelevantIds = [
      ...UNIVERSAL_ATTRIBUTES.map(a => a.id),
      ...catAttrs.map(a => a.id),
      ...subAttrs.map(a => a.id)
    ];
    return allRelevantIds.includes(fieldId);
  };

  useEffect(() => {
    if (!autoDetectionEnabled || !title || title.length < 3) return;

    // ── Phase 1: Instant local detection (legacy, runs immediately) ──
    const match = detectCategory(title);
    if (match && match.confidence > 0.6) {
      isAutoDetecting.current = true;
      const detectedGender = match.gender;
      if (NEW_CATEGORIES_CONFIG[detectedGender]) {
        setGender(detectedGender as any);
        const catConfig = NEW_CATEGORIES_CONFIG[detectedGender].find(c =>
          c.id === match.category || c.label === match.category || c.label.toLowerCase() === match.category.toLowerCase()
        );
        if (catConfig) {
          setCategory(catConfig.label);
          if (match.subcategory) {
            const subConfig = catConfig.subcategories?.find(s =>
              s.id === match.subcategory || s.label === match.subcategory || s.label.toLowerCase() === match.subcategory.toLowerCase()
            );
            if (subConfig) setSubcategory(subConfig.id);
            else setSubcategory('');
          } else {
            setSubcategory('');
          }
        }
      }
      setTimeout(() => { isAutoDetecting.current = false; }, 500);
    }
  }, [title, autoDetectionEnabled]);

  // ── Phase 2: Domain Discovery override (async, higher priority) ──
  // Maps ML category_path to gender/category/subcategory for backward compatibility
  const handleSelectDomainSuggestion = (suggestion: typeof domainSuggestion) => {
    if (!suggestion?.category_name) return;

    const path = suggestion.category_path || [];
    const suggestedId = suggestion.category_id;

    isAutoDetecting.current = true;

    // Map path to gender/category/subcategory
    if (path.length >= 1) {
      // path[0] = root (e.g., "Hogar, Muebles y Jardín") → maps to gender
      setGender(path[0].name as any);
    }
    if (path.length >= 2) {
      // Second-to-last = category, last = subcategory
      if (path.length === 2) {
        setCategory(path[1].name);
        setSubcategory('');
      } else {
        // path[-2] = category, path[-1] = subcategory
        setCategory(path[path.length - 2].name);
        setSubcategory(path[path.length - 1].name);
      }
    } else {
      setCategory(suggestion.category_name);
      setSubcategory('');
    }

    setMlCategoryId(suggestedId);
    setTimeout(() => { isAutoDetecting.current = false; }, 500);
  };

  // Auto-apply when domainSuggestion changes
  useEffect(() => {
    if (!autoDetectionEnabled || !domainSuggestion?.category_name) return;
    handleSelectDomainSuggestion(domainSuggestion);
  }, [domainSuggestion, autoDetectionEnabled]);

  // ELIMINADO: El reset agresivo de categoría impedía escribir categorías nuevas o selecciones manuales fluidas.
  // Solo se sincroniza si es necesario en la detección automática.

  useEffect(() => {
    const autoTags = generateTags(gender, category, subcategory || null, attributes);
    setTags(prev => Array.from(new Set([...prev, ...autoTags])));
  }, [gender, category, subcategory, attributes]);

  const handleToggleAttribute = (id: string) => {
    setDisabledAttributes(prev => {
      const isDisabling = !prev.includes(id);
      if (isDisabling) {
        setAttributes(curr => {
          const next = { ...curr };
          delete next[id];
          return next;
        });
        return [...prev, id];
      } else {
        return prev.filter(x => x !== id);
      }
    });
  };

  const handleProposeCategory = async (newCat: string) => {
    const normalized = newCat.trim();
    if (normalized.length < 3) return;
    const exists = categories.some(c => c.localeCompare(normalized, undefined, { sensitivity: 'base' }) === 0);
    if (exists) {
      const existing = categories.find(c => c.localeCompare(normalized, undefined, { sensitivity: 'base' }) === 0);
      if (existing) setCategory(existing);
      return;
    }
    if (!window.confirm(`¿Deseas proponer la creación de la categoría "${normalized}"?`)) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setPendingCategories(prev => [...prev, normalized]);
        setCategory(normalized);
        await supabase.from('category_requests').insert({
          user_id: user.id,
          category_name: normalized,
          gender: gender,
          status: 'pending'
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const canSubmit = useMemo(() => {
    const parsedDirectPrice = Number(priceInput || 0);
    const parsedStartingBid = Number(auctionStartingBidInput || 0);
    const parsedBidIncrement = Number(auctionBidIncrementInput || 0);
    const totalImages = existingImages.length + files.length;
    const MAX_IMAGES = 15;

    const baseOk =
      title.trim().length >= 3 &&
      totalImages >= 2 &&
      totalImages <= MAX_IMAGES &&
      !isSaving &&
      uploadingCount === 0 &&
      category.trim().length > 0 &&
      color.trim().length > 0;

    if (!baseOk) return false;

    // Validar límite de destacados
    if (isFeatured) {
      if (!limitsUsage?.featured.allowed && limitsUsage?.featured.limit !== Infinity) {
        // Si ya llegamos al límite, solo permitimos si ya era featured (editando uno existente)
        // Pero isFeatured es el estado NUEVO.
        // Si initialData.is_featured era true, entonces no estamos "consumiendo" uno nuevo, estamos manteniendo.
        // Pero limitsUsage cuenta los activos. Si este ya es activo y featured, está contado en usage.
        // Si editamos: usage incluye este listing.
        // Si creamos: usage NO incluye este listing.

        // Si usage >= limit:
        // - Create: No allowed.
        // - Edit: Si ya era featured, allowed (porque es el mismo slot). Si no era featured, No allowed.

        // Simplificación: limitsUsage.allowed suele ser (usage < limit).
        // Si usage == limit, allowed es false.

        if (isEdit && initialData?.is_featured) {
          // Permitir mantener
        } else {
          return false;
        }
      }
    }

    if (saleType === 'direct') {
      if (!isEdit && limitsUsage && !limitsUsage.listings.allowed) return false;
      return Number.isFinite(parsedDirectPrice) && parsedDirectPrice > 0;
    }

    if (!isEdit && limitsUsage && !limitsUsage.auctions.allowed) return false;

    const start = new Date(auctionStartDateTime);
    const end = new Date(auctionEndDateTime);
    const validDates = !isNaN(start.getTime()) && !isNaN(end.getTime());
    if (!validDates) return false;

    const durationMs = end.getTime() - start.getTime();
    const oneHourMs = 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const durOk = durationMs >= oneHourMs && durationMs <= sevenDaysMs;
    const incOk = Number.isFinite(parsedBidIncrement) && parsedBidIncrement > 0;

    // Validar que subastas con envío gratis GoVendy tengan precio que cubra envío + comisión
    if (freeShipping && !shippingBySeller && shippingCost !== null && shippingCost > 0) {
      const plan: PlanType = limitsUsage?.plan || 'basic';
      const commRate = plan === 'basic' ? 0.10 : plan === 'pro' ? 0.07 : 0.05;
      const commFee = parsedStartingBid * commRate;
      if (parsedStartingBid < (shippingCost + commFee)) return false;
    }

    return durOk && incOk && Number.isFinite(parsedStartingBid) && parsedStartingBid > 0;
  }, [
    title, existingImages.length, files.length, isSaving, uploadingCount, category, color,
    priceInput, saleType, limitsUsage, isEdit, auctionBidIncrementInput,
    auctionStartDateTime, auctionEndDateTime, auctionStartingBidInput,
    freeShipping, shippingBySeller, shippingCost
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setIsSaving(true);
      setPageError(null);

      const rawPrice = saleType === 'direct' ? priceInput : auctionStartingBidInput;
      const numericPrice = Number(rawPrice || '0');

      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        throw new Error('Ingresa un precio válido.');
      }

      if (numericPrice < 25) {
        throw new Error('El precio mínimo de publicación es de $25.00 MXN.');
      }

      const plan: PlanType =
        limitsUsage?.plan ||
        (userProfile?.plan_type as PlanType) ||
        'basic';

      const rates = commissionRates || {
        basic: PLAN_LIMITS.basic.commission_percent,
        pro: PLAN_LIMITS.pro.commission_percent,
        platinum: PLAN_LIMITS.platinum.commission_percent,
      };

      const appliedPercent = plan === 'basic' ? rates.basic : plan === 'pro' ? rates.pro : rates.platinum;
      const appliedRate = appliedPercent / 100;
      const minCommission = plan === 'basic' ? rates.basic : plan === 'pro' ? rates.pro : rates.platinum;
      const numericShippingSubsidy = shippingSubsidy ? Number(shippingSubsidy) : 0;
      const numericCustomShipping = Number(customShippingPrice || 0);
      const shippingRevenue = allowPersonalDelivery
        ? 0
        : freeShipping
          ? 0
          : shippingBySeller
            ? numericCustomShipping
            : shippingCost !== null
              ? Math.max(0, shippingCost - numericShippingSubsidy)
              : 0;
      const revenueAfterDiscounts = numericPrice + shippingRevenue - numericShippingSubsidy;

      if (revenueAfterDiscounts <= minCommission) {
        throw new Error(`El precio es insuficiente. Después de envío, subsidios y descuentos no cubre la comisión mínima de $${minCommission}.`);
      }

      if (saleType === 'direct') {
        let commissionFee = numericPrice * appliedRate;
        if (commissionFee < minCommission) {
          commissionFee = minCommission;
        }

        const netWithoutShipping = numericPrice - commissionFee;
        if (netWithoutShipping < 0) {
          throw new Error('Con este precio la comisión supera el valor del producto. Aumenta el precio.');
        }

        const isFreeShippingBySeller = Boolean(
          shippingBySeller && (customShippingPrice || '') === '0',
        );
        const isFreeShippingPlatform = Boolean(
          freeShipping && !shippingBySeller,
        );

        if (numericPrice === 25 && (isFreeShippingBySeller || isFreeShippingPlatform)) {
          throw new Error('Con un precio de $25 no puedes ofrecer envío gratis al publicar. Aumenta el precio o cobra envío.');
        }

        // Validar envío gratis GoVendy: precio debe cubrir envío + comisión
        if (isFreeShippingPlatform && shippingCost && shippingCost > 0) {
          const projectedEarnings = numericPrice - commissionFee - shippingCost;
          if (projectedEarnings < 0) {
            throw new Error(
              `No puedes publicar con envío gratis: tu precio ($${numericPrice.toFixed(2)}) no cubre el costo de envío ($${shippingCost.toFixed(2)}) + comisión ($${commissionFee.toFixed(2)}). ` +
              `Necesitas un precio mínimo de $${Math.ceil(shippingCost + commissionFee).toFixed(2)} o desactiva el envío gratis.`
            );
          }
        }

        if (
          isFreeShippingBySeller &&
          shippingCost &&
          shippingCost > 0 &&
          numericPrice < shippingCost
        ) {
          throw new Error('El precio es menor al costo estimado de envío ofreciendo envío gratis por tu cuenta. Ajusta el precio o el envío.');
        }

        if (shippingBySeller && shippingCost && shippingCost > 0) {
          const buyerShipping = Number(customShippingPrice || '0');
          const sellerShippingSubsidy = Math.max(0, shippingCost - buyerShipping);
          const projectedEarnings =
            numericPrice - commissionFee - sellerShippingSubsidy;

          if (projectedEarnings < 0) {
            throw new Error('Con este precio y configuración de envío tendrías saldo negativo después de comisión y envío. Ajusta el precio o el envío.');
          }
        }
      }

      // === VALIDACIONES PARA SUBASTAS ===
      if (saleType === 'auction' && !isDigital) {
        const minAuctionForFreeShipping = 200;
        // Bloquear envío gratis GoVendy en subastas de precio bajo
        if (freeShipping && !shippingBySeller) {
          if (numericPrice < minAuctionForFreeShipping) {
            throw new Error(
              `No puedes ofrecer envío gratis GoVendy en una subasta con precio inicial menor a $${minAuctionForFreeShipping}. ` +
              `Si la subasta no alcanza un precio que cubra el envío, generaría pérdidas. ` +
              `Aumenta el precio inicial o selecciona otro tipo de envío.`
            );
          }
          if (shippingCost && shippingCost > 0 && numericPrice < shippingCost) {
            throw new Error(
              'El precio inicial de la subasta no cubre el costo estimado de envío GoVendy ofreciendo envío gratis. ' +
              'Ajusta el precio inicial o desactiva el envío gratis.'
            );
          }
        }
        // Bloquear envío gratis por vendedor en subastas de precio bajo
        if (shippingBySeller && numericCustomShipping === 0 && numericPrice < minAuctionForFreeShipping) {
          throw new Error(
            `No puedes ofrecer envío gratis gestionado por el vendedor en una subasta con precio inicial menor a $${minAuctionForFreeShipping}. ` +
            `Aumenta el precio inicial o cobra envío.`
          );
        }
      }

      setUploadingCount(files.length);
      const uploadedUrls: string[] = [];
      for (const f of files) {
        const url = await uploadFile(f);
        uploadedUrls.push(url);
        setUploadingCount((c) => Math.max(0, c - 1));
      }

      // --- CRITICAL FIX: Replace Blob URLs with Permanent URLs in Description ---
      // Map preview blobs to their new permanent storage URLs
      const blobToPermanentMap = new Map<string, string>();
      files.forEach((_, i) => {
        if (previewUrls[i] && uploadedUrls[i]) {
          blobToPermanentMap.set(previewUrls[i], uploadedUrls[i]);
        }
      });

      const replaceBlobsInString = (str: string) => {
        if (!str) return str;
        let newStr = str;
        blobToPermanentMap.forEach((perm, blob) => {
          // Replace all occurrences of the blob URL
          newStr = newStr.split(blob).join(perm);
        });
        return newStr;
      };

      // 1. Fix plain description (used for fallbacks/search)
      const finalDescriptionText = replaceBlobsInString(description);

      // 2. Fix blocks (used for rendering)
      let finalDescriptionBlocks = descriptionBlocks ? JSON.parse(JSON.stringify(descriptionBlocks)) : null;
      if (finalDescriptionBlocks) {
        finalDescriptionBlocks = finalDescriptionBlocks.map((block: any) => {
          // Fix RichText blocks (HTML content)
          if (block.type === 'richtext' && block.content) {
            return { ...block, content: replaceBlobsInString(block.content) };
          }
          // Fix Image blocks (direct URL)
          if (block.type === 'image' && block.url) {
            // Check if exact match first
            if (blobToPermanentMap.has(block.url)) {
              return { ...block, url: blobToPermanentMap.get(block.url) };
            }
            // Fallback: replace if it's part of the string (unlikely for direct url property but safe)
            return { ...block, url: replaceBlobsInString(block.url) };
          }
          return block;
        });
      }
      // --------------------------------------------------------------------------

      const finalImages = [...existingImages, ...uploadedUrls];
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuario no autenticado');

      // Calcular shipping_price para guardar en la BD
      // settle-one usa este valor para determinar el costo de envío GoVendy
      let computedShippingPrice = 0;
      if (!isDigital) {
        if (shippingBySeller) {
          computedShippingPrice = numericCustomShipping;
        } else if (!freeShipping && shippingCost !== null && shippingCost > 0) {
          // GoVendy shipping: guardar el costo calculado por Estafeta
          // Se guarda INCLUSO si allowPersonalDelivery está habilitado,
          // porque ambas opciones pueden coexistir y settle-one necesita el precio GoVendy
          computedShippingPrice = Math.max(0, shippingCost - numericShippingSubsidy);
        }
        // freeShipping=true → shipping_price=0
      }

      const payload: any = {
        title,
        description: finalDescriptionText,
        price: saleType === 'direct' ? Number(priceInput) : Number(auctionStartingBidInput),
        currency: 'MXN',
        images: finalImages,
        gender,
        size: attributes['size'] || 'M',
        brand: attributes['brand']?.trim() || brand.trim(),
        model: attributes['model']?.trim() || model.trim(),
        color: attributes['color']?.trim() || color.trim(),
        category,
        subcategory,
        attributes: {
          ...attributes,
          ml_category_id: mlCategoryId,
          ml_attributes: (() => {
            // Save only filled ML attribute values along with their names for display
            const filled: Record<string, { name: string; value: string; value_name?: string }> = {};
            for (const group of meliAttrGroups) {
              for (const attr of group.attributes) {
                const val = meliAttrValues[attr.id];
                if (val) {
                  // For list type, find the value name
                  const valueName = attr.values?.find(v => v.id === val)?.name;
                  filled[attr.id] = {
                    name: attr.name,
                    value: val,
                    ...(valueName ? { value_name: valueName } : {}),
                  };
                }
              }
            }
            return Object.keys(filled).length > 0 ? filled : undefined;
          })(),
        },
        tags,
        sale_type: saleType,
        condition: condition || null,
        stock: stock ? Number(stock) : 1,
        product_type: productType,
        digital_delivery_type: isDigital ? 'manual' : null,
        digital_delivery_fields: isDigital ? digitalDeliveryFields : [],
        free_shipping: isDigital ? true : Boolean(freeShipping),
        shipping_subsidy: isDigital ? 0 : numericShippingSubsidy,
        weight_kg: isDigital ? 0 : Number(weight),
        length_cm: isDigital ? 0 : Number(length),
        width_cm: isDigital ? 0 : Number(width),
        height_cm: isDigital ? 0 : Number(height),
        shipping_by_seller: isDigital ? false : Boolean(shippingBySeller),
        allow_personal_delivery: isDigital ? false : Boolean(allowPersonalDelivery),
        handling_days: isDigital ? 0 : Number(handlingDays),
        shipping_carrier: isDigital ? '' : selectedShippingCarrier,
        shipping_price: computedShippingPrice,

        auction_start_at: saleType === 'auction' ? new Date(auctionStartDateTime).toISOString() : null,
        auction_end_at: saleType === 'auction' ? new Date(auctionEndDateTime).toISOString() : null,
        auction_starting_bid: saleType === 'auction' ? Number(auctionStartingBidInput) : 0,
        auction_bid_increment: saleType === 'auction' ? Number(auctionBidIncrementInput) : 0,
        auction_highest_bid: saleType === 'auction' ? Number(auctionStartingBidInput) : 0,

        // Variantes
        size_variants: sizeVariants.length > 0 ? sizeVariants : null,
        size_stock: Object.keys(sizeStock).length > 0 ? sizeStock : null,
        size_type: sizeVariants.length > 0 ? sizeType : null,
        color_variants: colorVariants.length > 0 ? colorVariants : null,

        description_blocks: finalDescriptionBlocks,
        is_featured: isFeatured,
        wholesale_tiers: wholesaleTiers.length > 0 ? wholesaleTiers : null,
        youtube_url: (limitsUsage?.plan === 'pro' || limitsUsage?.plan === 'platinum') ? (youtubeUrl.trim() || null) : null,
      };

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      // Determinar endpoint y método
      // Create: /api/listings/create (POST)
      // Clone:  /api/listings/create (POST) -> (Aunque 'clone' real ya ocurrió, aquí manejamos si ListingForm se usara para clonar desde cero, pero en el flujo actual es Edit)
      // Edit:   /api/listings/update (POST) -> body: { listingId, patch }

      let endpoint = '';
      let finalBody: any = {};

      if (isCreate || isClone) {
        endpoint = '/api/listings/create';
        // Si es clone desde el form (no desde dashboard), forzamos draft. 
        // Pero si venimos de Edit, isClone es false.
        if (isClone) {
          payload.title = `${payload.title} (copia)`;
          payload.status = 'draft';
          payload.is_featured = false;
        } else {
          // Create normal -> Active
          payload.status = 'active';
        }
        finalBody = payload;
      } else {
        // Edit mode
        endpoint = '/api/listings/update';
        // Si era borrador o estaba pausado y editamos, lo activamos al guardar (simular "Publicar")
        if (initialData?.status === 'draft' || initialData?.status === 'paused') {
          payload.status = 'active';
        }
        finalBody = {
          listingId: listingId,
          patch: payload
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(finalBody)
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al guardar');

      if (json.warning) {
        setSuccess('⚠️ ' + json.warning);
        setTimeout(() => {
          window.location.href = `/listings/${json.id || listingId}`;
        }, 3000);
      } else {
        setSuccess('Publicación guardada con éxito.');
        setTimeout(() => {
          window.location.href = `/listings/${json.id || listingId}`;
        }, 900);
      }

    } catch (err: any) {
      setPageError(err.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
      setUploadingCount(0);
    }
  };

  // Calculate missing fields for Pocky
  const formStatus = useMemo(() => {
    const missing = [];
    if (existingImages.length + files.length === 0) missing.push('Fotos');
    if (!title) missing.push('Título');
    if (!description) missing.push('Descripción');
    if (!priceInput) missing.push('Precio');
    if (!category) missing.push('Categoría');
    if (saleType === 'auction') {
      if (!auctionStartDateTime) missing.push('Fecha inicio subasta');
      if (!auctionStartingBidInput) missing.push('Precio inicial');
    }

    // Calculate percentage
    const totalFields = saleType === 'auction' ? 7 : 5;
    const filled = totalFields - missing.length;
    const percent = Math.round((filled / totalFields) * 100);

    return { missing, percent };
  }, [existingImages.length, files.length, title, description, priceInput, category, saleType, auctionStartDateTime, auctionStartingBidInput]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">{isEdit ? 'Editar' : 'Vender'}</div>
              <div className="text-xs text-gray-500">{isEdit ? 'Actualizar publicación' : 'Crear publicación'}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Cancelar
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <ProExpirationBanner />

        {pageError && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pageError}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} onKeyDown={(e) => {
          // Prevent Enter key from auto-submitting the form
          // Only the explicit submit button should trigger submission
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
            const isSubmitButton = (e.target as HTMLElement).closest('button[type="submit"]');
            if (!isSubmitButton) {
              e.preventDefault();
            }
          }
        }} className="space-y-6">

          {/* ── Banner Liverpool-rosa: cabecera del formulario ── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-500 to-teal-400 px-6 py-5 shadow-md">
            {/* Círculos decorativos de fondo */}
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-6 right-16 h-20 w-20 rounded-full bg-white/10" />
            <div className="relative flex items-center gap-4">
              {/* Ícono carrito animado */}
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
                <svg
                  width="26" height="26" viewBox="0 0 24 24"
                  fill="none" stroke="white" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: 'cartBounce 1.4s ease-in-out infinite' }}
                >
                  <circle cx="9" cy="21" r="1" fill="white" stroke="white" />
                  <circle cx="20" cy="21" r="1" fill="white" stroke="white" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                {/* Punto de notificación pulsante */}
                <span className="absolute -right-1 -top-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                </span>
              </div>
              <style>{`
                @keyframes cartBounce {
                  0%, 100% { transform: translateY(0px) rotate(0deg); }
                  25% { transform: translateY(-4px) rotate(-3deg); }
                  50% { transform: translateY(0px) rotate(0deg); }
                  75% { transform: translateY(-2px) rotate(2deg); }
                }
              `}</style>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-white/75">GoVendy</p>
                <h1 className="text-lg font-extrabold leading-tight text-white drop-shadow-sm">
                  Formulario para publicar tu artículo
                </h1>
              </div>
            </div>
          </div>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <ImageUploader
              existingImages={existingImages}
              files={files}
              previewUrls={previewUrls}
              maxImages={15}
              onSelectFiles={(newFiles) => {
                setFiles((prev) => [...prev, ...newFiles]);
                const newUrls = newFiles.map((f) => URL.createObjectURL(f));
                setPreviewUrls((prev) => [...prev, ...newUrls]);
              }}
              onRemoveExisting={removeExistingImageAt}
              onRemoveNew={removeFileAt}
            />
          </section>

          {/* ── Video de YouTube (Solo Pro / Platinum) ── */}
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🎬</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Video del producto (opcional)</p>
                <p className="text-xs text-gray-500">
                  {limitsUsage?.plan === 'pro' || limitsUsage?.plan === 'platinum'
                    ? 'Pega el link de un video de YouTube para mostrarlo en tu publicación'
                    : 'Disponible para vendedores Pro y Platinum'}
                </p>
              </div>
            </div>
            {limitsUsage?.plan === 'pro' || limitsUsage?.plan === 'platinum' ? (
              <>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="block w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-emerald-500 outline-none"
                />
                {youtubeUrl && (() => {
                  const match = youtubeUrl.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
                  return match ? (
                    <div className="mt-3 rounded-xl overflow-hidden aspect-video bg-gray-100">
                      <iframe
                        src={`https://www.youtube.com/embed/${match[1]}`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="Vista previa del video"
                      />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-red-500">URL de YouTube no válida. Ejemplo: https://www.youtube.com/watch?v=dQw4w9WgXcQ</p>
                  );
                })()}
              </>
            ) : (
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-4 text-center">
                <p className="text-sm font-semibold text-gray-800">🔒 Función exclusiva Pro / Platinum</p>
                <p className="text-xs text-gray-500 mt-1">Agrega videos a tus publicaciones para aumentar tus ventas hasta un 40%</p>
                <Link href="/planes" className="mt-3 inline-block rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-1.5 text-xs font-bold text-white shadow-sm hover:shadow-md transition-shadow">
                  Mejorar mi plan →
                </Link>
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                  placeholder="Ej. Vestido Zara Nuevo"
                />
              </div>

              {/* Descripción */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Descripción</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDescriptionMode('richtext')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${descriptionMode === 'richtext'
                        ? 'bg-brand-emerald text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      Editor Rico
                    </button>
                    <button
                      type="button"
                      onClick={() => setDescriptionMode('blocks')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${descriptionMode === 'blocks'
                        ? 'bg-brand-emerald text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      Bloques
                    </button>
                    {descriptionMode === 'blocks' && (
                      <button
                        type="button"
                        onClick={() => setShowTemplateSelector(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700 hover:bg-purple-200"
                      >
                        📄 Usar Plantilla
                      </button>
                    )}
                  </div>
                </div>

                {descriptionMode === 'richtext' ? (
                  <RichTextEditor
                    content={richTextContent}
                    onChange={handleRteChange}
                    availableImages={[...existingImages, ...previewUrls]}
                  />
                ) : (
                  <TemplateEditor
                    blocks={descriptionBlocks || []}
                    onChange={setDescriptionBlocks}
                    availableImages={[...existingImages, ...previewUrls]}
                  />
                )}
              </div>

              {/* Tipo de Venta */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700">Tipo de publicación</label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSaleType('direct')}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 px-4 text-sm font-bold transition-all ${saleType === 'direct'
                      ? 'border-brand-emerald bg-emerald-50 text-brand-emerald'
                      : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                      }`}
                  >
                    Venta Directa
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSaleType('auction'); setFreeShipping(false); setShippingSubsidy('0'); }}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 px-4 text-sm font-bold transition-all ${saleType === 'auction'
                      ? 'border-brand-emerald bg-emerald-50 text-brand-emerald'
                      : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                      }`}
                  >
                    Subasta
                  </button>
                </div>
              </div>

              {saleType === 'direct' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Precio</label>
                      <div className="relative mt-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          value={priceInput}
                          onChange={e => setPriceInput(e.target.value)}
                          className="block w-full rounded-xl border-gray-300 pl-7 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Stock</label>
                      <input
                        type="number"
                        value={stock}
                        onChange={e => setStock(e.target.value)}
                        className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                        placeholder="1"
                      />
                    </div>
                  </div>

                  {/* Mayoreo */}
                  <div className="mt-4 rounded-2xl bg-blue-50/60 p-4 ring-1 ring-blue-100">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showWholesaleEditor}
                        onChange={(e) => {
                          setShowWholesaleEditor(e.target.checked);
                          if (!e.target.checked) setWholesaleTiers([]);
                        }}
                        className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-semibold text-blue-900">
                        🏪 Activar precios por mayoreo
                      </span>
                      <span className="text-[10px] text-blue-600">
                        (Descuentos por cantidad)
                      </span>
                    </label>
                    {showWholesaleEditor && (
                      <div className="mt-3">
                        <WholesaleTierEditor
                          tiers={wholesaleTiers}
                          onChange={setWholesaleTiers}
                          basePrice={Number(priceInput) || undefined}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4 rounded-2xl bg-gray-50 p-4 ring-1 ring-black/5">
                  <h4 className="text-sm font-bold text-gray-900">Configuración de Subasta</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Puja Inicial (MXN)</label>
                      <input
                        type="number"
                        value={auctionStartingBidInput}
                        onChange={e => setAuctionStartingBidInput(e.target.value)}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                        placeholder="1.00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Incremento mínimo (MXN)</label>
                      <input
                        type="number"
                        value={auctionBidIncrementInput}
                        onChange={e => setAuctionBidIncrementInput(e.target.value)}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                        placeholder="10.00"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Fecha de Inicio</label>
                      <input
                        type="date"
                        value={auctionStartDate}
                        onChange={e => setAuctionStartDate(e.target.value)}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Hora de Inicio</label>
                      <input
                        type="time"
                        value={auctionStartTime}
                        onChange={e => setAuctionStartTime(e.target.value)}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Duración</label>
                      <select
                        value={auctionDurationHours}
                        onChange={e => setAuctionDurationHours(Number(e.target.value))}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                      >
                        <option value={1}>1 Hora</option>
                        <option value={3}>3 Horas</option>
                        <option value={6}>6 Horas</option>
                        <option value={12}>12 Horas</option>
                        <option value={24}>1 Día</option>
                        <option value={48}>2 Días</option>
                        <option value={72}>3 Días</option>
                        <option value={120}>5 Días</option>
                        <option value={168}>7 Días</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-gray-500 text-right">
                    Finaliza: {auctionEndDateTime ? new Date(auctionEndDateTime).toLocaleString() : '...'}
                  </div>
                </div>
              )}

              <div className="grid gap-6 sm:grid-cols-2">
                {isFieldRelevant('brand') && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Marca</label>
                    <input
                      type="text"
                      value={brand}
                      onChange={e => setBrand(e.target.value)}
                      className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                      placeholder="Ej. Zara, Nike"
                    />
                  </div>
                )}
                {isFieldRelevant('model') && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Modelo</label>
                    <input
                      type="text"
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                      placeholder="Ej. Air Max 270"
                    />
                  </div>
                )}
              </div>

              {/* Selector de Categoría (estilo breadcrumb ML) */}
              <div>
                <label className="mb-1.5 block text-sm font-bold text-gray-900">Categoría</label>
                <MLCategorySelector
                  suggestion={domainSuggestion}
                  allSuggestions={allDomainSuggestions}
                  isLoading={isDomainLoading}
                  onSelect={(s) => {
                    handleSelectDomainSuggestion(s);
                    setManualSearchTitle('');
                  }}
                  onManualSearch={(q) => setManualSearchTitle(q)}
                  disabled={mode === 'edit'}
                />
              </div>

              {isFieldRelevant('condition') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Condición</label>
                  <div className="mt-2 flex gap-3">
                    {(['nuevo', 'usado', 'casi_nuevo'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCondition(c)}
                        className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${condition === c
                          ? 'bg-brand-emerald text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                      >
                        {c === 'nuevo' ? 'Nuevo' : c === 'usado' ? 'Usado' : 'Casi Nuevo'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isFieldRelevant('color') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Color Principal</label>
                  <input
                    type="text"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
                    placeholder="Ej. Rojo, Azul"
                  />
                </div>
              )}

              {/* Variantes de Talla - Solo para Ropa (NO Calzado ni Accesorios sin talla) */}
              {IS_FASHION_ROOT(gender) &&
                !['Calzado', 'Zapatos', 'Tenis', 'Botas', 'Sandalias'].includes(category) &&
                !['Bolsos', 'Joyería', 'Lentes', 'Relojes', 'Accesorios de Cabello', 'Carteras', 'Mochilas', 'Maletas', 'Paraguas'].includes(category) && (
                  <div className="rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-emerald-50/50 to-white p-6">
                    <h3 className="mb-4 text-lg font-bold text-gray-900">
                      👕 Variantes de Talla (Ropa)
                    </h3>
                    <SizeVariantSelector
                      sizeType="clothing"
                      selectedSizes={sizeVariants}
                      sizeStock={sizeStock}
                      onSizesChange={setSizeVariants}
                      onStockChange={setSizeStock}
                      onSizeTypeChange={setSizeType}
                      allowedTypes={['clothing']}
                    />
                  </div>
                )}

              {/* Variantes de Talla - Solo para Calzado */}
              {(category === 'Zapatos' || category === 'Calzado' || category === 'Tenis' || category === 'Botas' || category === 'Sandalias') && (
                <div className="rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-blue-50/50 to-white p-6">
                  <h3 className="mb-4 text-lg font-bold text-gray-900">
                    👟 Variantes de Talla (Calzado)
                  </h3>
                  <SizeVariantSelector
                    sizeType="shoes"
                    selectedSizes={sizeVariants}
                    sizeStock={sizeStock}
                    onSizesChange={setSizeVariants}
                    onStockChange={setSizeStock}
                    onSizeTypeChange={setSizeType}
                    allowedTypes={['shoes']}
                  />
                </div>
              )}

              {/* Tabla de Tallas Personalizada — se muestra para cualquier categoría de moda */}
              {(IS_FASHION_ROOT(gender) || detectClothingType(category, subcategory)) && (
                <div className="rounded-2xl border-2 border-dashed border-[#e3127d]/30 bg-gradient-to-br from-pink-50/40 to-white p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">📏 Guía de Tallas del Vendedor</h3>
                      <p className="mt-0.5 text-xs text-gray-500">Opcional — agrega tus propias medidas si difieren de las estándar.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSizeChartEditor((p) => !p);
                        if (!showSizeChartEditor && !customSizeChart) {
                          setCustomSizeChart({
                            title: '',
                            columns: [{ key: 'busto', label: 'Busto (cm)' }, { key: 'cintura', label: 'Cintura (cm)' }, { key: 'cadera', label: 'Cadera (cm)' }],
                            rows: [
                              { size: 'S', values: {} },
                              { size: 'M', values: {} },
                              { size: 'L', values: {} },
                            ],
                          });
                        }
                        if (showSizeChartEditor) {
                          // clear custom chart
                          setCustomSizeChart(null);
                          setAttributes(prev => { const n = { ...prev }; delete n.custom_size_chart; return n; });
                        }
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${showSizeChartEditor
                        ? 'bg-[#e3127d] text-white'
                        : 'bg-pink-100 text-[#c0005a] hover:bg-pink-200'
                        }`}
                    >
                      {showSizeChartEditor ? '✕ Quitar' : '+ Agregar'}
                    </button>
                  </div>

                  {showSizeChartEditor && customSizeChart && (
                    <div className="mt-4 space-y-4">
                      {/* Visual Reference for Category */}
                      {(() => {
                        const clothingType = detectClothingType(category, subcategory, mlCategoryId);
                        if (!clothingType) return null;
                        return (
                          <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-pink-50 to-white p-4 ring-1 ring-pink-100 shadow-sm border border-pink-50/50">
                            <div className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-2">Referencia de Medidas</div>
                            <div className="w-32 h-32 flex items-center justify-center">
                              <DiagramForType type={clothingType} />
                            </div>
                            <div className="mt-2 text-[9px] text-gray-400 text-center italic">Sigue los números en el dibujo para llenar las columnas</div>
                          </div>
                        );
                      })()}

                      {/* Title */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Título de la tabla (opcional)</label>
                        <input
                          type="text"
                          value={customSizeChart.title || ''}
                          onChange={e => setCustomSizeChart(p => p ? { ...p, title: e.target.value } : p)}
                          className="w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-pink-500 focus:ring-pink-500"
                          placeholder="Ej: Medidas según nuestra marca"
                        />
                      </div>

                      {/* Column editor */}
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700">Columnas de medida</label>
                          <button
                            type="button"
                            onClick={() => setCustomSizeChart(p => p ? {
                              ...p,
                              columns: [...p.columns, { key: `col_${Date.now()}`, label: 'Nueva' }]
                            } : p)}
                            className="text-xs font-bold text-[#e3127d] hover:text-[#c0005a]"
                          >
                            + Columna
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {customSizeChart.columns.map((col, ci) => (
                            <div key={col.key} className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1">
                              <input
                                value={col.label}
                                onChange={e => setCustomSizeChart(p => p ? {
                                  ...p,
                                  columns: p.columns.map((c, i) => i === ci ? { ...c, label: e.target.value } : c)
                                } : p)}
                                className="w-24 border-0 p-0 text-xs focus:ring-0"
                              />
                              {customSizeChart.columns.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setCustomSizeChart(p => p ? { ...p, columns: p.columns.filter((_, i) => i !== ci) } : p)}
                                  className="ml-1 text-gray-400 hover:text-red-500 text-xs"
                                >✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Table editor */}
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-3 py-2 text-left font-bold text-gray-700">Talla</th>
                              {customSizeChart.columns.map(col => (
                                <th key={col.key} className="px-3 py-2 text-left font-bold text-gray-700">{col.label}</th>
                              ))}
                              <th className="px-2 py-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {customSizeChart.rows.map((row, ri) => (
                              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                                <td className="px-2 py-1">
                                  <input
                                    value={row.size}
                                    onChange={e => setCustomSizeChart(p => p ? {
                                      ...p,
                                      rows: p.rows.map((r, i) => i === ri ? { ...r, size: e.target.value } : r)
                                    } : p)}
                                    className="w-12 rounded border-gray-200 px-1 py-0.5 text-xs font-bold text-[#c0005a] focus:border-pink-400 focus:ring-pink-400"
                                  />
                                </td>
                                {customSizeChart.columns.map(col => (
                                  <td key={col.key} className="px-2 py-1">
                                    <input
                                      value={row.values[col.key] || ''}
                                      onChange={e => setCustomSizeChart(p => p ? {
                                        ...p,
                                        rows: p.rows.map((r, i) => i === ri ? { ...r, values: { ...r.values, [col.key]: e.target.value } } : r)
                                      } : p)}
                                      className="w-20 rounded border-gray-200 px-1 py-0.5 text-xs focus:border-pink-400 focus:ring-pink-400"
                                      placeholder="—"
                                    />
                                  </td>
                                ))}
                                <td className="px-2 py-1">
                                  <button
                                    type="button"
                                    onClick={() => setCustomSizeChart(p => p ? { ...p, rows: p.rows.filter((_, i) => i !== ri) } : p)}
                                    className="text-gray-300 hover:text-red-400 text-xs"
                                  >✕</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <button
                          type="button"
                          onClick={() => setCustomSizeChart(p => p ? {
                            ...p,
                            rows: [...p.rows, { size: '', values: {} }]
                          } : p)}
                          className="w-full rounded-b-xl border-t border-gray-200 py-2 text-xs font-bold text-[#e3127d] hover:bg-pink-50"
                        >
                          + Agregar talla
                        </button>
                      </div>

                      {/* Save to attributes */}
                      <button
                        type="button"
                        onClick={() => setAttributes(prev => ({ ...prev, custom_size_chart: customSizeChart }))}
                        className="w-full rounded-xl bg-[#e3127d] py-2 text-xs font-bold text-white hover:bg-[#c0005a]"
                      >
                        ✓ Guardar tabla de tallas personalizada
                      </button>
                      {(attributes as any).custom_size_chart && (
                        <p className="text-center text-[ 10px] text-green-600">✓ Tabla guardada — se mostrará en tu publicación</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Variantes de Color */}
              <div className="rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-purple-50/50 to-white p-6">
                <h3 className="mb-4 text-lg font-bold text-gray-900">
                  🎨 Variantes de Color
                </h3>
                <ColorVariantManager
                  colors={colorVariants}
                  onColorsChange={setColorVariants}
                />
              </div>

              {/* Atributos Dinámicos */}
              {activeAttributes.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <h3 className="mb-3 text-sm font-bold text-gray-900">Características Específicas</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {activeAttributes.map(attr => (
                      <div key={attr.id} className={disabledAttributes.includes(attr.id) ? 'opacity-50 grayscale' : ''}>
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-medium text-gray-700">{attr.label}</label>
                          {!attr.required && (
                            <button type="button" onClick={() => handleToggleAttribute(attr.id)} className="text-[10px] text-gray-400 hover:text-gray-600">
                              {disabledAttributes.includes(attr.id) ? 'Habilitar' : 'No aplica'}
                            </button>
                          )}
                        </div>
                        <input
                          type={attr.type === 'number' ? 'number' : 'text'}
                          disabled={disabledAttributes.includes(attr.id)}
                          value={attributes[attr.id] || ''}
                          onChange={e => setAttributes(prev => ({ ...prev, [attr.id]: e.target.value }))}
                          className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-pink-500 focus:ring-pink-500 disabled:bg-gray-100"
                          placeholder={attr.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Atributos de MercadoLibre (dinámicos, agrupados por categoría ML) */}
              {mlCategoryId && meliAttrGroups.length > 0 && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">📋</span>
                    <h3 className="text-sm font-bold text-gray-900">Características del Producto</h3>
                    {isMeliAttrsLoading && (
                      <svg className="h-3 w-3 animate-spin text-orange-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400">Completa los que apliquen a tu producto. Los campos con * son requeridos.</p>

                  {meliAttrGroups.map((group) => {
                    const isCollapsed = collapsedGroups.has(group.group_id);
                    const filledCount = group.attributes.filter(a => meliAttrValues[a.id]).length;
                    const requiredCount = group.attributes.filter(a => a.required).length;

                    return (
                      <div key={group.group_id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        {/* Group header */}
                        <button
                          type="button"
                          onClick={() => setCollapsedGroups(prev => {
                            const next = new Set(prev);
                            if (next.has(group.group_id)) next.delete(group.group_id);
                            else next.add(group.group_id);
                            return next;
                          })}
                          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50/80 hover:bg-gray-100/80 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-gray-800">{group.group_name}</h4>
                            <span className="text-[10px] text-gray-400">
                              {filledCount}/{group.attributes.length}
                              {requiredCount > 0 && ` · ${requiredCount} requeridos`}
                            </span>
                          </div>
                          <svg
                            className={`h-4 w-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Group attributes */}
                        {!isCollapsed && (
                          <div className="px-4 py-3 grid gap-3 sm:grid-cols-2">
                            {group.attributes.map((mAttr) => (
                              <div key={mAttr.id}>
                                <label className="block text-xs font-medium text-gray-700">
                                  {mAttr.name}
                                  {mAttr.required && <span className="text-red-400 ml-0.5">*</span>}
                                </label>
                                {mAttr.values && mAttr.values.length > 0 ? (
                                  <select
                                    value={meliAttrValues[mAttr.id] || ''}
                                    onChange={e => setMeliAttrValues(prev => ({ ...prev, [mAttr.id]: e.target.value }))}
                                    className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-orange-400 focus:ring-orange-400"
                                  >
                                    <option value="">Seleccionar...</option>
                                    {mAttr.values.map(v => (
                                      <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                  </select>
                                ) : mAttr.value_type === 'boolean' ? (
                                  <select
                                    value={meliAttrValues[mAttr.id] || ''}
                                    onChange={e => setMeliAttrValues(prev => ({ ...prev, [mAttr.id]: e.target.value }))}
                                    className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-orange-400 focus:ring-orange-400"
                                  >
                                    <option value="">Seleccionar...</option>
                                    <option value="true">Sí</option>
                                    <option value="false">No</option>
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={meliAttrValues[mAttr.id] || ''}
                                    onChange={e => setMeliAttrValues(prev => ({ ...prev, [mAttr.id]: e.target.value }))}
                                    className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-orange-400 focus:ring-orange-400"
                                    placeholder={mAttr.hint || `Ej: ${mAttr.name}`}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Tipo de Producto: Físico / Digital */}
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h3 className="mb-4 text-sm font-bold text-gray-900">Tipo de Producto</h3>
                <div className="flex gap-3 mb-4">
                  {(['physical', 'digital'] as const).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => {
                        setProductType(pt);
                        if (pt === 'digital') {
                          // Clear physical shipping state
                          setFreeShipping(true);
                          setShippingBySeller(false);
                          setAllowPersonalDelivery(false);
                          setWeight('0');
                          setLength('0');
                          setWidth('0');
                          setHeight('0');
                          setHandlingDays('0');
                          setShippingSubsidy('0');
                        }
                      }}
                      className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ring-1 ${productType === pt
                        ? pt === 'digital'
                          ? 'bg-purple-600 text-white ring-purple-600 shadow-lg shadow-purple-200'
                          : 'bg-brand-emerald text-white ring-brand-emerald shadow-lg shadow-pink-200'
                        : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
                        }`}
                    >
                      {pt === 'physical' ? '📦 Producto Físico' : '💎 Producto Digital'}
                    </button>
                  ))}
                </div>

                {isDigital && (
                  <div className="rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">🔑</span>
                      <h4 className="text-sm font-bold text-purple-900">Campos de Entrega Digital</h4>
                    </div>
                    <p className="text-xs text-purple-700 mb-4">
                      Define qué datos entregarás al comprador después del pago (ej: Serial, Usuario, Contraseña, Link de descarga).
                    </p>

                    <div className="space-y-2 mb-3">
                      {digitalDeliveryFields.map((field, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs text-purple-500 font-mono w-5">{idx + 1}.</span>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => {
                              const updated = [...digitalDeliveryFields];
                              updated[idx] = { label: e.target.value };
                              setDigitalDeliveryFields(updated);
                            }}
                            className="flex-1 rounded-lg border-purple-200 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
                            placeholder="Nombre del campo"
                          />
                          {digitalDeliveryFields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setDigitalDeliveryFields(prev => prev.filter((_, i) => i !== idx))}
                              className="text-red-400 hover:text-red-600 text-sm"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newFieldLabel.trim()) {
                            e.preventDefault();
                            setDigitalDeliveryFields(prev => [...prev, { label: newFieldLabel.trim() }]);
                            setNewFieldLabel('');
                          }
                        }}
                        className="flex-1 rounded-lg border-purple-200 text-sm shadow-sm focus:border-purple-500 focus:ring-purple-500"
                        placeholder="Agregar campo (ej: Contraseña)"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newFieldLabel.trim()) {
                            setDigitalDeliveryFields(prev => [...prev, { label: newFieldLabel.trim() }]);
                            setNewFieldLabel('');
                          }
                        }}
                        className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700"
                      >
                        + Agregar
                      </button>
                    </div>

                    <div className="mt-3 rounded-lg bg-purple-100/50 p-3">
                      <p className="text-xs text-purple-600">
                        ⚡ Después del pago, recibirás una notificación para llenar estos campos desde &quot;Mis Ventas&quot;.
                        El comprador verá los datos en &quot;Mis Compras&quot;.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Envío — Solo para productos físicos */}
              {!isDigital && (
                <div className="mt-6 border-t border-gray-100 pt-6">
                  <h3 className="mb-4 text-sm font-bold text-gray-900">Configuración de Envío</h3>
                  {gopocketFlagReady && !gopocketShippingEnabled && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <p className="font-bold">Envíos GoVendy no disponibles</p>
                      <p className="mt-1 text-xs leading-snug">
                        El administrador desactivó el envío integrado. Configura envío gestionado por ti (precio y paquetería).
                      </p>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className={`rounded-xl border p-4 ${saleType === 'auction' ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-900">Envío Gratis</p>
                          <p className="text-xs text-gray-500">
                            {saleType === 'auction'
                              ? 'No disponible en subastas'
                              : 'Ofrece envío gratuito al comprador'}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={freeShipping}
                          disabled={saleType === 'auction'}
                          onChange={e => setFreeShipping(e.target.checked)}
                          className="h-5 w-5 rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 p-4" data-mode-id="pickup">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-900">Entrega Personal</p>
                          <p className="text-xs text-gray-500">Permitir entrega en persona</p>
                        </div>
                        <input
                          id="shipping-mode-pickup"
                          type="checkbox"
                          checked={allowPersonalDelivery}
                          onChange={e => setAllowPersonalDelivery(e.target.checked)}
                          className="h-5 w-5 rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                        />
                      </div>
                      {allowPersonalDelivery && (
                        <p className="mt-2 text-[11px] text-blue-600 leading-snug">
                          ℹ️ Si activas esta opción solo será visible para los compradores de tu ciudad y el comprador podrá elegirla al comprar.
                        </p>
                      )}
                    </div>
                  </div>

                  {gopocketFlagReady && gopocketShippingEnabled && !shippingBySeller && (
                    <>
                      <div className="mt-4 grid gap-4 sm:grid-cols-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Peso real (kg)</label>
                          <input
                            type="number"
                            value={weight}
                            onChange={e => setWeight(e.target.value)}
                            className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-pink-500 focus:ring-pink-500"
                            placeholder="0.5"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Largo (cm)</label>
                          <input
                            type="number"
                            value={length}
                            onChange={e => setLength(e.target.value)}
                            className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-pink-500 focus:ring-pink-500"
                            placeholder="20"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Ancho (cm)</label>
                          <input
                            type="number"
                            value={width}
                            onChange={e => setWidth(e.target.value)}
                            className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-pink-500 focus:ring-pink-500"
                            placeholder="15"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Alto (cm)</label>
                          <input
                            type="number"
                            value={height}
                            onChange={e => setHeight(e.target.value)}
                            className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-pink-500 focus:ring-pink-500"
                            placeholder="10"
                          />
                        </div>
                      </div>

                      {/* --- Envíos GoVendy (Estafeta) Checkbox --- */}
                      <div className={`mt-4 rounded-xl border transition-all ${!shippingBySeller ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-white'} p-4`} data-mode-id="gopocket">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-blue-900">Envíos GoVendy</p>
                            <p className="text-xs text-blue-600/70">Paquete Express / Estafeta / DHL / FedEx / 99 Minutos / J&T / Sendex</p>
                          </div>
                          <input
                            id="shipping-mode-gopocket"
                            type="checkbox"
                            checked={!shippingBySeller}
                            onChange={(e) => setShippingBySeller(!e.target.checked)}
                            className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>

                        {!shippingBySeller && (
                          <div className="mt-4 border-t border-blue-200/50 pt-4">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-black text-blue-900 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                CÁLCULO DE ENVÍO
                              </h4>
                              {isCalculatingShipping && <span className="text-[10px] font-bold text-blue-500 animate-pulse">COTIZANDO...</span>}
                            </div>
                            <p className="text-[10px] text-blue-700/70 mb-1">
                              📦 La paquetería se asigna al azar y depende de la ubicación, medidas y peso de tu paquete.
                            </p>
                            <p className="text-[10px] text-amber-700 font-semibold mb-4">
                              ⚠️ Evita sobrepesos: agrega medidas y peso exacto de tu producto para calcular el peso volumétrico correcto. Si el comprador requiere más de 2 piezas, puedes generarle una publicación especial para que pague el envío correcto sin generarte sobrepesos.
                            </p>
                            <p className="text-[10px] text-blue-600 font-semibold mb-4">
                              📦 Si tu paquete pesa de 6 kg en adelante requiere un envío por producto. En esos casos incentiva a tus clientes a comprar en tu publicación que es necesario un envío por producto.
                            </p>
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div className="bg-white/60 p-3 rounded-xl border border-white">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Peso Volumétrico</p>
                                <p className="text-sm font-black text-gray-700">{volumetricWeight.toFixed(2)} kg</p>
                                <p className="text-[9px] text-gray-400 mt-1 italic">* Basado en dimensiones</p>
                              </div>
                              <div className="bg-white/60 p-3 rounded-xl border border-white">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Costo de Guía</p>
                                <p className="text-sm font-black text-brand-emerald">{shippingCost ? formatMoney(shippingCost) : '$ --'}</p>
                                <p className="text-[9px] text-gray-400 mt-1 italic">* Sujeto a cobertura</p>
                              </div>
                              {/* Ocultar subsidio completamente en subastas (evita que el vendedor cubra el 100% del envío y genere pérdidas) */}
                              {saleType !== 'auction' && (
                                <div className="bg-white p-3 rounded-xl border-2 border-brand-emerald/20 shadow-sm">
                                  <label className="text-[10px] font-bold text-brand-emerald uppercase tracking-wider block mb-1">Tu Subsidio (MXN)</label>
                                  <input
                                    type="number"
                                    value={shippingSubsidy}
                                    onChange={e => setShippingSubsidy(e.target.value)}
                                    className="w-full bg-transparent border-none p-0 text-sm font-black text-gray-900 focus:ring-0"
                                    placeholder="0.00"
                                  />
                                  <p className="text-[9px] text-pink-400 mt-1 italic">* Descontado de tus ganancias</p>
                                </div>
                              )}
                            </div>


                            {shippingCost !== null && (
                              <div className="mt-4 pt-4 border-t border-blue-100 flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-800">
                                  {freeShipping ? 'Costo de envío (lo absorbes tú):' : 'Costo final para el Comprador:'}
                                </span>
                                <span className="text-lg font-black text-blue-900">
                                  {freeShipping
                                    ? formatMoney(shippingCost)
                                    : formatMoney(Math.max(0, shippingCost - Number(shippingSubsidy || 0)))}
                                </span>
                              </div>
                            )}

                            {/* Warning: subasta con envío gratis donde el precio no cubre */}
                            {saleType === 'auction' && freeShipping && shippingCost !== null && shippingCost > 0 && (() => {
                              const bid = Number(auctionStartingBidInput || 0);
                              const plan: PlanType = limitsUsage?.plan || 'basic';
                              const commRate = plan === 'basic' ? 0.10 : plan === 'pro' ? 0.07 : 0.05;
                              const commFee = bid * commRate;
                              const minPrice = shippingCost + commFee;
                              if (bid > 0 && bid < minPrice) {
                                return (
                                  <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2">
                                    <p className="text-xs font-bold text-red-800">⚠️ Precio insuficiente</p>
                                    <p className="text-[11px] text-red-700 mt-1">
                                      El precio de inicio ({formatMoney(bid)}) no cubre el envío ({formatMoney(shippingCost)}) + comisión ({formatMoney(commFee)}).
                                      Precio mínimo requerido: <strong>{formatMoney(Math.ceil(minPrice))}</strong>
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4" data-mode-id="seller_managed">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">Envío Gestionado por Vendedor</p>
                        <p className="text-xs text-gray-500">Tú te encargas de la logística y el costo</p>
                      </div>
                      <input
                        id="shipping-mode-seller"
                        type="checkbox"
                        checked={shippingBySeller}
                        onChange={e => setShippingBySeller(e.target.checked)}
                        className="h-5 w-5 rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                      />
                    </div>
                    {shippingBySeller && (
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Precio de Envío (MXN)</label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="number"
                              value={customShippingPrice}
                              onChange={e => setCustomShippingPrice(e.target.value)}
                              disabled={customShippingPrice === '0'}
                              className={`block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-pink-500 focus:ring-pink-500 ${customShippingPrice === '0' ? 'bg-gray-100 text-gray-500' : ''}`}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="mt-2 flex items-center">
                            <input
                              id="free-shipping-seller"
                              type="checkbox"
                              checked={customShippingPrice === '0'}
                              onChange={(e) => setCustomShippingPrice(e.target.checked ? '0' : '')}
                              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-600"
                            />
                            <label htmlFor="free-shipping-seller" className="ml-2 text-xs font-bold text-green-700 cursor-pointer">
                              Ofrecer Envío Gratis (Yo lo pago)
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Paquetería Preferente</label>
                          <select
                            value={selectedShippingCarrier}
                            onChange={e => setSelectedShippingCarrier(e.target.value)}
                            className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-pink-500 focus:ring-pink-500"
                          >
                            <option value="">Selecciona una opción</option>
                            <option value="estafeta">Estafeta</option>
                            <option value="fedex">FedEx</option>
                            <option value="dhl">DHL</option>
                            <option value="otro">Otro / Propio</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Días de preparación (Handling)</label>
                    <select
                      value={handlingDays}
                      onChange={e => setHandlingDays(e.target.value)}
                      className="mt-1 block w-full rounded-xl border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 sm:text-sm"
                    >
                      {[0, 1, 2, 3, 4, 5, 7, 10].map(d => (
                        <option key={d} value={d.toString()}>{d === 0 ? 'Mismo día' : `${d} día(s) hábil(es)`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Destacar Publicación */}
              <div className="mt-6 rounded-xl border border-pink-100 bg-pink-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-5 items-center">
                    <input
                      id="featured-checkbox"
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      disabled={!limitsUsage?.featured.allowed && !isFeatured && (!isEdit || !initialData?.is_featured)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                    />
                  </div>
                  <div className="text-sm">
                    <label htmlFor="featured-checkbox" className="font-medium text-gray-900">
                      Destacar esta publicación
                    </label>
                    <p className="text-gray-500">
                      Tu artículo aparecerá en la sección de destacados y en los primeros resultados.
                    </p>
                    {limitsUsage && (
                      <div className="mt-1 text-xs font-semibold text-pink-700">
                        {limitsUsage.featured.limit === Infinity
                          ? 'Destacados ilimitados'
                          : `Has usado ${limitsUsage.featured.usage} de ${limitsUsage.featured.limit} destacados.`
                        }
                        {!limitsUsage.featured.allowed && !isFeatured && (!isEdit || !initialData?.is_featured) && (
                          <span className="block text-red-600">Has alcanzado tu límite. Actualiza a PRO para más.</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end pt-6">
            <button
              type="submit"
              disabled={!canSubmit || isSaving}
              className="rounded-xl bg-brand-emerald px-8 py-3 text-lg font-bold text-white shadow-lg shadow-pink-200 transition-all hover:bg-pink-600 hover:shadow-xl disabled:opacity-50 disabled:shadow-none"
            >
              {isSaving ? 'Guardando...' : (isEdit ? 'Guardar Cambios' : 'Publicar Ahora')}
            </button>
          </div>
        </form>
        <PublicationAssistantPocky
          error={pageError}
          isSaving={isSaving}
          missingFields={formStatus.missing}
          completionPercent={formStatus.percent}
          currentCategory={category}
        />
      </main>

      {/* Modal de Selector de Plantillas */}
      {
        showTemplateSelector && (
          <TemplateSelector
            onSelect={(blocks) => {
              setDescriptionBlocks(blocks);
              setDescriptionMode('blocks');
            }}
            onClose={() => setShowTemplateSelector(false)}
          />
        )
      }
    </div >
  );
}
