import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'h1',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'img',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'span',
  'div',
  'a',
  'blockquote',
  'code',
  'pre',
  'mark',
];

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'width',
  'height',
  'style',
  'class',
  'colspan',
  'rowspan',
  'align',
];

/** Sanitiza HTML del editor rico preservando estilos inline (color, tamaño, alineación). */
export function sanitizeRichHtml(html: string): string {
  const raw = String(html || '').trim();
  if (!raw) return '';

  return DOMPurify.sanitize(raw, {
    ADD_TAGS: ALLOWED_TAGS,
    ADD_ATTR: ALLOWED_ATTR,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  });
}
