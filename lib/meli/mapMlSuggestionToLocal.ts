import { NEW_CATEGORIES_CONFIG, ROOT_CATEGORIES } from '@/lib/categories';
import type { DomainSuggestion } from '@/lib/hooks/useDomainDiscovery';

export type LocalCategoryPick = {
  root: string;
  categoryLabel: string;
  subcategoryId: string;
};

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(normalize(text).split(/\s+/).filter((t) => t.length >= 2));
}

/** Texto de búsqueda unificado a partir de la sugerencia de ML */
export function mlSuggestionHaystack(s: DomainSuggestion): string {
  const parts = [
    s.domain_name,
    s.category_name,
    ...(s.category_path || []).map((p) => p.name),
  ].filter(Boolean) as string[];
  return normalize(parts.join(' '));
}

function scoreCandidate(
  haystackNorm: string,
  hayTokens: Set<string>,
  root: string,
  catLabel: string,
  subLabel: string,
  subId: string,
): number {
  let score = 0;
  const pack = normalize(`${root} ${catLabel} ${subLabel} ${subId}`);
  if (pack.length > 6 && haystackNorm.includes(pack)) score += 40;

  for (const term of pack.split(/\s+/)) {
    if (term.length < 3) continue;
    if (haystackNorm.includes(term)) score += Math.min(term.length, 12);
  }

  for (const t of tokenSet(`${catLabel} ${subLabel}`)) {
    if (t.length >= 3 && hayTokens.has(t)) score += 6;
  }

  for (const w of normalize(catLabel).split(/\s+/)) {
    if (w.length >= 4 && haystackNorm.includes(w)) score += 10;
  }
  for (const w of normalize(subLabel).split(/\s+/)) {
    if (w.length >= 4 && haystackNorm.includes(w)) score += 14;
  }

  return score;
}

/** Mejor raíz GoVendy a partir del primer segmento del path ML (o dominio). */
function guessRootFromMlHint(hint: string): string {
  const h = normalize(hint);
  if (!h) return 'Otros';
  let best = 'Otros';
  let bestScore = 0;
  for (const root of ROOT_CATEGORIES) {
    const rt = normalize(root);
    let s = 0;
    for (const term of rt.split(/\s+/)) {
      if (term.length < 3) continue;
      if (h.includes(term)) s += term.length;
    }
    for (const term of h.split(/\s+/)) {
      if (term.length < 3) continue;
      if (rt.includes(term)) s += term.length;
    }
    if (s > bestScore) {
      bestScore = s;
      best = root;
    }
  }
  return best;
}

function firstPickInRoot(root: string): LocalCategoryPick {
  const cats = NEW_CATEGORIES_CONFIG[root];
  if (!cats?.length) {
    const o = NEW_CATEGORIES_CONFIG['Otros']![0];
    const sub = o.subcategories?.[0];
    return { root: 'Otros', categoryLabel: o.label, subcategoryId: sub?.id ?? '' };
  }
  const cat = cats[0];
  const sub = cat.subcategories?.[0];
  return { root, categoryLabel: cat.label, subcategoryId: sub?.id ?? '' };
}

/**
 * Mapea una sugerencia de Domain Discovery (MercadoLibre) a departamento + categoría + subcategoría (id)
 * del árbol local `NEW_CATEGORIES_CONFIG`.
 */
export function mapMlSuggestionToLocal(suggestion: DomainSuggestion | null): LocalCategoryPick | null {
  if (!suggestion) return null;
  const haystackNorm = mlSuggestionHaystack(suggestion);
  if (!haystackNorm) return null;
  const hayTokens = tokenSet(haystackNorm);

  let best: LocalCategoryPick | null = null;
  let bestScore = 0;

  for (const root of ROOT_CATEGORIES) {
    const cats = NEW_CATEGORIES_CONFIG[root];
    if (!cats) continue;
    for (const cat of cats) {
      const subs = cat.subcategories?.length ? cat.subcategories : [];
      if (!subs.length) {
        const sc = scoreCandidate(haystackNorm, hayTokens, root, cat.label, '', cat.id);
        if (sc > bestScore) {
          bestScore = sc;
          best = { root, categoryLabel: cat.label, subcategoryId: cat.id };
        }
        continue;
      }
      for (const sub of subs) {
        const sc = scoreCandidate(haystackNorm, hayTokens, root, cat.label, sub.label, sub.id);
        if (sc > bestScore) {
          bestScore = sc;
          best = { root, categoryLabel: cat.label, subcategoryId: sub.id };
        }
      }
    }
  }

  const MIN_SCORE = 10;
  if (best && bestScore >= MIN_SCORE) return best;

  const path = suggestion.category_path || [];
  const hint = path[0]?.name || suggestion.domain_name || suggestion.category_name || '';
  const root = guessRootFromMlHint(hint);
  const cats = NEW_CATEGORIES_CONFIG[root] || NEW_CATEGORIES_CONFIG['Otros']!;
  const tail = path[path.length - 1]?.name || suggestion.category_name || '';

  let pick = firstPickInRoot(root);
  let pickScore = 0;
  const tailNorm = normalize(tail);
  for (const cat of cats) {
    for (const sub of cat.subcategories || []) {
      const sc = scoreCandidate(haystackNorm, hayTokens, root, cat.label, sub.label, sub.id);
      if (sc > pickScore) {
        pickScore = sc;
        pick = { root, categoryLabel: cat.label, subcategoryId: sub.id };
      }
    }
  }

  if (tailNorm.length >= 4) {
    for (const cat of cats) {
      for (const sub of cat.subcategories || []) {
        if (normalize(sub.label).includes(tailNorm) || tailNorm.includes(normalize(sub.label))) {
          return { root, categoryLabel: cat.label, subcategoryId: sub.id };
        }
      }
    }
  }

  return pick;
}
