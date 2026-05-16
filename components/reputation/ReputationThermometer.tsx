'use client';

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function clampPct(v: any) {
  const n = typeof v === 'number' ? v : Number(v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function ReputationThermometer({
  percent,
  label,
  subtitle,
}: {
  percent: number;
  label: string;
  subtitle?: string | null;
}) {
  const pct = clampPct(percent);
  const left = `calc(${pct}% - 10px)`;

  // Determinar color y mensaje según el rango
  let colorClass = '';
  let borderColor = '';
  let message = '';
  
  if (pct >= 80) {
    // 80-100%: Verde
    colorClass = 'text-green-900';
    borderColor = 'border-green-300 bg-white';
    message = `Este vendedor ha tenido satisfacción en el ${pct}% de sus ventas`;
  } else if (pct >= 55) {
    // 55-79%: Amarillo
    colorClass = 'text-amber-900';
    borderColor = 'border-amber-300 bg-amber-50';
    message = `Este vendedor ha tenido satisfacción en el ${pct}% de sus ventas`;
  } else if (pct >= 1) {
    // 1-54%: Rojo
    colorClass = 'text-red-900';
    borderColor = 'border-red-300 bg-red-50';
    message = 'Este vendedor NO ha tenido buenas reseñas en sus ventas';
  } else {
    // 0%: Sin datos
    colorClass = 'text-gray-900';
    borderColor = 'border-gray-300 bg-gray-50';
    message = 'Aún no hay suficientes datos de reputación';
  }

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${
      pct >= 80 
        ? 'border-green-200 bg-gradient-to-br from-green-50 to-green-100/50' 
        : pct >= 55 
        ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50' 
        : pct >= 1
        ? 'border-red-200 bg-gradient-to-br from-red-50 to-red-100/50'
        : 'border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100/50'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</div>
          {subtitle ? <div className="mt-1 text-xs text-gray-500 line-clamp-2">{subtitle}</div> : null}
        </div>
        <div className={`shrink-0 text-right rounded-xl px-3 py-2 ${borderColor}`}>
          <div className={`text-2xl font-extrabold ${colorClass}`}>{pct}%</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="relative">
          {/* Marker */}
          <div className="absolute -top-6" style={{ left }}>
            <div className="flex flex-col items-center">
              <div className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ring-1 shadow-sm ${
                pct >= 80 
                  ? 'bg-green-100 text-green-800 ring-green-200' 
                  : pct >= 55 
                  ? 'bg-amber-100 text-amber-800 ring-amber-200' 
                  : pct >= 1
                  ? 'bg-red-100 text-red-800 ring-red-200'
                  : 'bg-gray-100 text-gray-800 ring-gray-200'
              }`}>
                {pct}%
              </div>
              <div
                className={`h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent ${
                  pct >= 80 
                    ? 'border-t-green-600' 
                    : pct >= 55 
                    ? 'border-t-amber-600' 
                    : pct >= 1
                    ? 'border-t-red-600'
                    : 'border-t-gray-600'
                }`}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Bar */}
          <div className="relative h-3 overflow-hidden rounded-full bg-gray-200 ring-1 ring-black/5">
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 35%, #22c55e 100%)',
                opacity: 0.9,
              }}
            />
            {/* subtle "fill" */}
            <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${pct}%` }} aria-hidden="true" />

            {/* marker line */}
            <div className="absolute inset-y-0 w-[2px] bg-white/90 shadow" style={{ left: `calc(${pct}% - 1px)` }} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Mensaje según el rango */}
      <div className={`mt-4 rounded-xl border px-3 py-2 ${borderColor}`}>
        <div className={`text-xs font-semibold ${colorClass}`}>{message}</div>
      </div>
    </div>
  );
}

