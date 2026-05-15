import type { TemplateBlock } from './blocks';

function isRecord(v: unknown): v is Record<string, any> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function asTrimmedString(v: unknown) {
  if (typeof v !== 'string') return '';
  return v.trim();
}

function limitString(s: string, max: number) {
  const t = typeof s === 'string' ? s : '';
  return t.length > max ? t.slice(0, max) : t;
}

export function isAllowedImageUrl(urlRaw: string) {
  const url = urlRaw.trim();
  if (!url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;

  // Allowlist: Cloudinary + Supabase Storage (public)
  const host = u.hostname.toLowerCase();
  const path = u.pathname || '';

  if (host === 'res.cloudinary.com') return true;

  // <project>.supabase.co/storage/v1/object/public/...
  if (host.endsWith('.supabase.co') && path.startsWith('/storage/v1/object/public/')) return true;

  return false;
}

export type ValidateBlocksResult =
  | { ok: true; blocks: TemplateBlock[] }
  | { ok: false; error: string };

export function validateTemplateBlocks(
  input: unknown,
  opts?: { maxBlocks?: number; allowImageSlots?: boolean },
): ValidateBlocksResult {
  const maxBlocks = Math.max(1, Math.min(200, Number(opts?.maxBlocks ?? 60) || 60));
  const allowImageSlots = Boolean(opts?.allowImageSlots);
  const arr = Array.isArray(input) ? input : [];
  if (!Array.isArray(input)) return { ok: false, error: 'Bloques inválidos (se esperaba un arreglo).' };
  if (arr.length > maxBlocks) return { ok: false, error: `Demasiados bloques (máximo ${maxBlocks}).` };

  const out: TemplateBlock[] = [];
  for (let i = 0; i < arr.length; i += 1) {
    const b = arr[i];
    if (!isRecord(b)) return { ok: false, error: `Bloque #${i + 1} inválido.` };
    const type = asTrimmedString(b.type);
    if (!type) return { ok: false, error: `Bloque #${i + 1} sin "type".` };

    if (type === 'heading') {
      const text = limitString(asTrimmedString(b.text), 140);
      const levelRaw = b.level;
      const level: 1 | 2 | 3 = levelRaw === 1 || levelRaw === 2 || levelRaw === 3 ? levelRaw : 2;
      if (!text) return { ok: false, error: `Bloque #${i + 1} (heading) sin texto.` };
      out.push({ type: 'heading', text, level });
      continue;
    }

    if (type === 'paragraph') {
      const text = limitString(asTrimmedString(b.text), 2500);
      if (!text) return { ok: false, error: `Bloque #${i + 1} (paragraph) sin texto.` };
      out.push({ type: 'paragraph', text });
      continue;
    }

    if (type === 'richtext') {
      const content = limitString(asTrimmedString((b as any).content), 10000);
      if (!content) return { ok: false, error: `Bloque #${i + 1} (richtext) sin contenido.` };
      out.push({ type: 'richtext', content });
      continue;
    }

    if (type === 'bullets') {
      const itemsIn = Array.isArray(b.items) ? b.items : [];
      const items = itemsIn
        .filter((x) => typeof x === 'string')
        .map((x) => limitString(x.trim(), 180))
        .filter(Boolean)
        .slice(0, 20);
      if (items.length === 0) return { ok: false, error: `Bloque #${i + 1} (bullets) sin elementos.` };
      out.push({ type: 'bullets', items });
      continue;
    }

    if (type === 'image') {
      const url = limitString(asTrimmedString(b.url), 800);
      const isSlot = (b as any).is_slot === false ? false : true;
      const slotIdIn = limitString(asTrimmedString((b as any).slot_id), 80);
      const slotLabelIn = limitString(asTrimmedString((b as any).slot_label), 80);
      const slotAspectRaw = limitString(asTrimmedString((b as any).slot_aspect), 24);
      const slot_aspect: 'portrait' | 'square' | 'landscape' =
        slotAspectRaw === 'square' || slotAspectRaw === 'landscape' || slotAspectRaw === 'portrait'
          ? (slotAspectRaw as any)
          : 'portrait';

      // Permitir placeholders (solo para plantillas): url vacío → se llena al publicar
      if (!url) {
        if (!allowImageSlots) return { ok: false, error: `Bloque #${i + 1} (image) sin url.` };
        if (!isSlot) return { ok: false, error: `Bloque #${i + 1} (image) requiere url (no está marcado como espacio).` };
        const alt = limitString(asTrimmedString(b.alt), 140);
        const caption = limitString(asTrimmedString(b.caption), 200);
        const slot_id = slotIdIn || `slot-${i + 1}`;
        const slot_label = slotLabelIn || `Imagen ${i + 1}`;
        out.push({
          type: 'image',
          url: '',
          alt: alt || undefined,
          caption: caption || undefined,
          is_slot: true,
          slot_id,
          slot_label,
          slot_aspect,
        });
        continue;
      }
      if (!isAllowedImageUrl(url)) {
        return {
          ok: false,
          error:
            `Bloque #${i + 1} (image) tiene una url no permitida.\n` +
            'Usa Cloudinary (`https://res.cloudinary.com/...`) o Supabase Storage público (`https://<proyecto>.supabase.co/storage/v1/object/public/...`).',
        };
      }
      const alt = limitString(asTrimmedString(b.alt), 140);
      const caption = limitString(asTrimmedString(b.caption), 200);
      out.push({
        type: 'image',
        url,
        alt: alt || undefined,
        caption: caption || undefined,
        is_slot: false,
        slot_id: slotIdIn || undefined,
        slot_label: slotLabelIn || undefined,
        slot_aspect,
      });
      continue;
    }

    if (type === 'divider') {
      out.push({ type: 'divider' });
      continue;
    }

    if (type === 'callout') {
      const title = limitString(asTrimmedString(b.title), 120);
      const body = limitString(asTrimmedString(b.body), 1200);
      const toneRaw = asTrimmedString(b.tone);
      const tone: 'pink' | 'neutral' | 'success' =
        toneRaw === 'pink' || toneRaw === 'success' || toneRaw === 'neutral' ? (toneRaw as any) : 'pink';
      if (!body) return { ok: false, error: `Bloque #${i + 1} (callout) sin body.` };
      out.push({ type: 'callout', title: title || undefined, body, tone });
      continue;
    }

    return { ok: false, error: `Bloque #${i + 1} tiene type no permitido: "${type}".` };
  }

  return { ok: true, blocks: out };
}

