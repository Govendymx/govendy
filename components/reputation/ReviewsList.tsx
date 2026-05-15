'use client';

import Link from 'next/link';

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export type PublicReview = {
  direction: 'buyer_to_seller' | 'seller_to_buyer' | string;
  stars: number;
  comment: string;
  created_at?: string | null;
  rater_name?: string | null;
  rater_id?: string | null;
};

function formatDateTime(input: string | null | undefined) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' });
}

function Stars({ value }: { value: number }) {
  const n = Math.max(1, Math.min(10, Math.round(Number(value) || 0)));
  const pct = Math.round((n / 10) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200 ring-1 ring-black/5" aria-hidden="true">
        <div className="h-full bg-brand-emerald" style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[11px] font-extrabold text-gray-900">{n}/10</div>
    </div>
  );
}

export function ReviewsList({
  title,
  subtitle,
  reviews,
  tone = 'pink',
}: {
  title: string;
  subtitle?: string | null;
  reviews: PublicReview[];
  tone?: 'pink' | 'neutral';
}) {
  const r = Array.isArray(reviews) ? reviews : [];
  const headerTone = tone === 'neutral' ? 'text-gray-900' : 'text-brand-emerald';

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={classNames('text-sm font-extrabold', headerTone)}>{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-gray-600">{subtitle}</div> : null}
        </div>
        <div className="shrink-0 rounded-full bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 ring-1 ring-black/10">
          {r.length}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {r.length === 0 ? (
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600 ring-1 ring-black/5">Aún no hay comentarios.</div>
        ) : (
          r.map((it, idx) => (
            <div key={`${idx}-${String(it.created_at || '')}`} className="rounded-3xl border border-black/5 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-gray-900">
                  {it.rater_id ? (
                    <Link href={`/perfil/${it.rater_id}`} className="text-brand-emerald hover:opacity-90 hover:underline">
                      {String(it.rater_name || 'Usuario')}
                    </Link>
                  ) : (
                    <span>{String(it.rater_name || 'Usuario')}</span>
                  )}
                  <span className="mx-2 text-gray-300">•</span>
                  <span className="text-gray-500">{formatDateTime(it.created_at)}</span>
                </div>
                <Stars value={it.stars} />
              </div>
              <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{String(it.comment || '').trim()}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

