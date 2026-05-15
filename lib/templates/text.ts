import type { TemplateBlock } from './blocks';

export function blocksToPlainText(blocks: TemplateBlock[]): string {
  const out: string[] = [];
  for (const b of blocks || []) {
    if (!b || typeof (b as any).type !== 'string') continue;
    if (b.type === 'heading') out.push(String(b.text || '').trim());
    if (b.type === 'paragraph') out.push(String(b.text || '').trim());
    if (b.type === 'richtext') {
      // Strip HTML tags for plain text representation
      const html = String((b as any).content || '');
      const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      out.push(plain);
    }
    if (b.type === 'bullets') out.push((b.items || []).map((x) => `- ${String(x || '').trim()}`).join('\n'));
    if (b.type === 'image') {
      const cap = String((b as any).caption || '').trim();
      if (cap) out.push(cap);
    }
    if (b.type === 'callout') {
      const t = String((b as any).title || '').trim();
      const body = String((b as any).body || '').trim();
      if (t) out.push(t);
      if (body) out.push(body);
    }
  }
  return out
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

