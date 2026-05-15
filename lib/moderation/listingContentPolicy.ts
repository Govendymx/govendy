export type ListingPolicyViolationKind =
  | 'phone'
  | 'email'
  | 'address'
  | 'whatsapp'
  | 'social'
  | 'external_link'
  | 'handle';

export type ListingPolicyViolation = {
  kind: ListingPolicyViolationKind;
  match: string;
};

export type ListingPolicyScanResult = {
  ok: boolean;
  violations: ListingPolicyViolation[];
  urls: string[];
};

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function extractUrls(text: string): string[] {
  const out: string[] = [];
  const re = /\b(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+)\b/gi;
  for (const m of Array.from(text.matchAll(re))) {
    const raw = String(m[1] || '').trim();
    if (!raw) continue;
    out.push(raw.startsWith('www.') ? `https://${raw}` : raw);
  }
  return uniq(out);
}

function digitsCount(s: string) {
  return (s.match(/\d/g) || []).length;
}

function looksLikePhone(s: string) {
  const d = digitsCount(s);
  // 7+ dígitos suele ser teléfono (MX: 10), tope 15 por E.164
  return d >= 7 && d <= 15;
}

function normalizeText(s: string) {
  return String(s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAllowedHosts(): string[] {
  // Puede venir vacío en build; ok.
  const env =
    (typeof process !== 'undefined' ? (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || '') : '') || '';
  try {
    const u = new URL(env);
    return [u.hostname].filter(Boolean);
  } catch {
    return [];
  }
}

function isAllowedInternalUrl(url: string, allowedHosts: string[]) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;

  // Permitimos links internos relativos SOLO a secciones públicas.
  const allowedPrefixes = ['/listings/', '/tienda/', '/perfil/'];
  if (trimmed.startsWith('/')) return allowedPrefixes.some((p) => trimmed.startsWith(p));

  // Absolutos: permitir solo si coincide host permitido y path permitido.
  try {
    const u = new URL(trimmed);
    if (!u.hostname) return false;
    if (!allowedHosts.includes(u.hostname)) return false;
    return allowedPrefixes.some((p) => u.pathname.startsWith(p));
  } catch {
    return false;
  }
}

export function scanListingContentPolicy(input: {
  title?: string | null;
  description?: string | null;
  blocksText?: string | null;
}): ListingPolicyScanResult {
  const text = normalizeText([input.title, input.description, input.blocksText].filter(Boolean).join('\n'));
  const lower = text.toLowerCase();
  const violations: ListingPolicyViolation[] = [];

  const urls = extractUrls(text);
  const allowedHosts = getAllowedHosts();

  // Links externos (incluye redes sociales)
  const socialHosts = new Set([
    'instagram.com',
    'www.instagram.com',
    'facebook.com',
    'www.facebook.com',
    'fb.com',
    'www.fb.com',
    'tiktok.com',
    'www.tiktok.com',
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
    'twitter.com',
    'www.twitter.com',
    'x.com',
    'www.x.com',
    'linkedin.com',
    'www.linkedin.com',
    't.me',
    'telegram.me',
    'wa.me',
    'api.whatsapp.com',
  ]);

  for (const u of urls) {
    let host = '';
    try {
      host = new URL(u).hostname.toLowerCase();
    } catch {
      host = '';
    }
    const allowed = isAllowedInternalUrl(u, allowedHosts);
    if (!allowed) {
      violations.push({ kind: socialHosts.has(host) ? 'social' : 'external_link', match: u });
    }
  }

  // WhatsApp explícito (aunque no haya link)
  if (
    /\b(whatsapp|whats|wpp|wa\.me|api\.whatsapp|whatssapp|guasap|guasappp)\b/i.test(text) ||
    /\b(telegram|t\.me)\b/i.test(text)
  ) {
    violations.push({ kind: 'whatsapp', match: 'whatsapp/telegram' });
  }

  // Emails
  const emailRe = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  for (const m of Array.from(text.matchAll(emailRe))) {
    const v = String(m[0] || '').trim();
    if (v) violations.push({ kind: 'email', match: v });
  }

  // Teléfonos
  const phoneRe = /(\+?\d[\d\s().-]{6,}\d)/g;
  for (const m of Array.from(text.matchAll(phoneRe))) {
    const v = String(m[1] || '').trim();
    if (v && looksLikePhone(v)) {
      // Evitar capturar años sueltos tipo 2025: requerimos 7+ dígitos ya; ok.
      violations.push({ kind: 'phone', match: v });
    }
  }

  // Handles tipo @usuario (evita emails)
  const handleRe = /(^|\s)@([a-zA-Z0-9_]{3,})\b/g;
  for (const m of Array.from(text.matchAll(handleRe))) {
    const full = `@${String(m[2] || '').trim()}`;
    if (!full) continue;
    if (full.includes('@') && /@.+\./.test(full)) continue; // paranoia
    violations.push({ kind: 'handle', match: full });
  }

  // Direcciones (heurística): keyword de dirección + al menos un número en el texto
  // MEJORA: Evitar falsos positivos comunes en descripciones de productos (ej. "bolsa interior", "uso exterior", "número de serie")
  // Requerimos combinaciones más fuertes o ignoramos si son términos aislados comunes.
  const addressStrongKeywords = /\b(calle|av\.?|avenida|colonia|fracc\.?|fraccionamiento|cp|c\.p\.|c[oó]digo postal|domicilio)\b/i;
  const addressWeakKeywords = /\b(interior|ext\.?|exterior|n[uú]mero|no\.|num\.?|entre|esquina)\b/i;
  
  // Solo marcamos "address" si hay una keyword FUERTE, o si hay una DÉBIL junto con un contexto de dirección más claro
  // Por ahora, para ser menos severos, solo usaremos las FUERTES.
  // Las débiles como "interior/exterior" dan demasiados falsos positivos en ropa/tecnología.
  if (addressStrongKeywords.test(text) && /\d/.test(text)) {
    violations.push({ kind: 'address', match: 'posible dirección' });
  }

  // Redes sociales por palabra (sin link)
  if (/\b(instagram|facebook|tiktok|youtube|twitter|x\.com|snapchat)\b/i.test(text)) {
    violations.push({ kind: 'social', match: 'redes sociales' });
  }

  const cleaned = uniq(violations.map((v) => `${v.kind}:${v.match}`)).map((s) => {
    const [kind, ...rest] = s.split(':');
    return { kind: kind as ListingPolicyViolationKind, match: rest.join(':') };
  });

  return { ok: cleaned.length === 0, violations: cleaned, urls };
}

export function listingPolicyHumanWarning(violations: ListingPolicyViolation[]) {
  const kinds = Array.from(new Set(violations.map((v) => v.kind)));
  const labels: Record<ListingPolicyViolationKind, string> = {
    phone: 'números de teléfono',
    email: 'correos',
    address: 'direcciones',
    whatsapp: 'WhatsApp/Telegram',
    social: 'redes sociales',
    external_link: 'links externos',
    handle: 'usuarios (@handle)',
  };
  const pretty = kinds.map((k) => labels[k] || k).join(', ');
  return (
    `Detectamos información no permitida en tu publicación (${pretty}). ` +
    'Por seguridad, no puedes compartir datos de contacto, redes sociales o links externos. ' +
    'Solo se permiten links de tiendas/publicaciones dentro de Pocket. ' +
    'Si intentas evadir esta regla, tu cuenta puede ser bloqueada de forma permanente.'
  );
}

