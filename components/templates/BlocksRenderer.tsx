'use client';

import type { TemplateBlock } from '@/lib/templates/blocks';
import DOMPurify from 'dompurify';

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function BlocksRenderer({ blocks }: { blocks: TemplateBlock[] }) {
  const arr = Array.isArray(blocks) ? blocks : [];
  if (arr.length === 0) return null;

  return (
    <div className="space-y-4">
      {arr.map((b, idx) => {
        if (!b) return null;
        if (b.type === 'richtext') {
          const htmlContent = (b as any).content || '';
          // Sanitize HTML before rendering
          // Allow specific tags and attributes for rich text features
          const cleanHtml = DOMPurify.sanitize(htmlContent, {
            ALLOWED_TAGS: [
              'p',
              'br',
              'strong',
              'em',
              'u',
              's',
              'h1',
              'h2',
              'h3',
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
            ],
            ALLOWED_ATTR: [
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
            ],
            FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
          });

          return (
            <div
              key={idx}
              className="prose prose-sm sm:prose-base max-w-none text-gray-700 prose-img:rounded-xl prose-img:shadow-sm prose-headings:font-bold prose-a:text-brand-emerald prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: cleanHtml }}
            />
          );
        }
        if (b.type === 'heading') {
          const lvl = (b.level ?? 2) as 1 | 2 | 3;
          const cls =
            lvl === 1 ? 'text-xl sm:text-2xl' : lvl === 2 ? 'text-lg sm:text-xl' : 'text-base sm:text-lg';
          return (
            <div key={idx} className={classNames('font-extrabold tracking-tight text-gray-900', cls)}>
              {b.text}
            </div>
          );
        }
        if (b.type === 'paragraph') {
          return (
            <p key={idx} className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {b.text}
            </p>
          );
        }
        if (b.type === 'bullets') {
          return (
            <ul key={idx} className="list-disc pl-5 text-sm text-gray-700 space-y-1">
              {b.items.map((it, j) => (
                <li key={j} className="leading-relaxed">
                  {it}
                </li>
              ))}
            </ul>
          );
        }
        if (b.type === 'divider') {
          return <div key={idx} className="h-px w-full bg-black/10" />;
        }
        if (b.type === 'callout') {
          const tone = b.tone ?? 'pink';

          const styles: Record<string, { box: string; title: string }> = {
            pink: { box: 'border-pink-200 bg-pink-50', title: 'text-brand-emerald' },
            neutral: { box: 'border-black/10 bg-gray-50', title: 'text-gray-900' },
            success: { box: 'border-green-200 bg-green-50', title: 'text-green-800' },
            blue: { box: 'border-blue-200 bg-blue-50', title: 'text-blue-800' },
            purple: { box: 'border-purple-200 bg-purple-50', title: 'text-purple-800' },
            amber: { box: 'border-amber-200 bg-amber-50', title: 'text-amber-800' },
            red: { box: 'border-red-200 bg-red-50', title: 'text-red-800' },
            indigo: { box: 'border-indigo-200 bg-indigo-50', title: 'text-indigo-800' },
            teal: { box: 'border-teal-200 bg-teal-50', title: 'text-teal-800' },
            cyan: { box: 'border-cyan-200 bg-cyan-50', title: 'text-cyan-800' },
          };

          const s = styles[tone] || styles.pink;

          return (
            <div key={idx} className={classNames('rounded-2xl border px-4 py-3', s.box)}>
              {b.title ? <div className={classNames('text-sm font-extrabold', s.title)}>{b.title}</div> : null}
              <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{b.body}</div>
            </div>
          );
        }
        if (b.type === 'image') {
          const url = String((b as any).url || '').trim();
          if (!url) {
            // Placeholder: no renderizar en público (evita espacios vacíos).
            return null;
          }
          return (
            <div key={idx} className="overflow-hidden rounded-2xl border border-black/5 bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={b.alt || ''} className="h-auto w-full object-cover" draggable={false} />
              {b.caption ? <div className="px-4 py-3 text-xs text-gray-600">{b.caption}</div> : null}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

