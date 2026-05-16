'use client';

import { sanitizeRichHtml } from '@/lib/templates/sanitizeRichHtml';

type Props = {
  html: string;
  className?: string;
};

/**
 * Renderiza HTML del editor TipTap sin la clase `prose` de Tailwind,
 * que sobrescribe colores y tamaños definidos con style="" en el editor.
 */
export function RichDescriptionContent({ html, className = '' }: Props) {
  const cleanHtml = sanitizeRichHtml(html);
  if (!cleanHtml) return null;

  return (
    <div
      className={`rich-description-content max-w-none text-gray-800 leading-relaxed
        [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
        [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2
        [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
        [&_h4]:text-lg [&_h4]:font-semibold
        [&_p]:my-2 [&_p]:text-base
        [&_strong]:font-bold [&_b]:font-bold
        [&_em]:italic [&_i]:italic
        [&_u]:underline [&_s]:line-through
        [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5
        [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5
        [&_li]:my-0.5
        [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:shadow-sm
        [&_a]:text-brand-emerald [&_a]:underline
        [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse
        [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1
        [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1
        [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic
        ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
}
