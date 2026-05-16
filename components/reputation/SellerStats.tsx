'use client';

type SellerStats = {
  total_orders: number;
  cancelled_orders: number;
  cancellation_rate: number;
  fast_shipping_count: number;
  delayed_shipping_count: number;
  average_shipping_days: number | null;
  has_problems: boolean;
  disputes_count: number;
};

export function SellerStats({ stats }: { stats: SellerStats | null | undefined }) {
  if (!stats || stats.total_orders === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        Aún no hay estadísticas de ventas disponibles.
      </div>
    );
  }

  const {
    total_orders,
    cancelled_orders,
    cancellation_rate,
    fast_shipping_count,
    delayed_shipping_count,
    average_shipping_days,
    has_problems,
    disputes_count,
  } = stats;

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">Estadísticas como vendedor</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Cancelaciones */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-700">Tasa de cancelación</div>
              <div className="mt-1 text-lg font-extrabold text-gray-900">{cancellation_rate}%</div>
            </div>
            <div className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              cancellation_rate <= 5 
                ? 'bg-green-100 text-green-800' 
                : cancellation_rate <= 15 
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {cancellation_rate <= 5 ? 'Excelente' : cancellation_rate <= 15 ? 'Aceptable' : 'Alta'}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {cancelled_orders} de {total_orders} órdenes canceladas
          </div>
        </div>

        {/* Velocidad de envío */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-700">Velocidad de envío</div>
              {average_shipping_days !== null ? (
                <div className="mt-1 text-lg font-extrabold text-gray-900">{average_shipping_days} días</div>
              ) : (
                <div className="mt-1 text-sm font-semibold text-gray-500">Sin datos</div>
              )}
            </div>
            <div className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              average_shipping_days !== null && average_shipping_days <= 2
                ? 'bg-green-100 text-green-800' 
                : average_shipping_days !== null && average_shipping_days <= 3
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {average_shipping_days !== null && average_shipping_days <= 2 
                ? 'Rápido' 
                : average_shipping_days !== null && average_shipping_days <= 3
                ? 'Normal' 
                : 'Lento'}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {fast_shipping_count} envíos rápidos, {delayed_shipping_count} con demora
          </div>
        </div>

        {/* Disputas */}
        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-700">Disputas</div>
              <div className="mt-1 text-lg font-extrabold text-gray-900">{disputes_count}</div>
            </div>
            <div className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              disputes_count === 0 
                ? 'bg-green-100 text-green-800' 
                : disputes_count <= 2
                ? 'bg-amber-100 text-amber-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {disputes_count === 0 ? 'Sin problemas' : disputes_count <= 2 ? 'Algunas' : 'Muchas'}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {disputes_count === 0 
              ? 'Ninguna disputa registrada' 
              : `${disputes_count} ${disputes_count === 1 ? 'disputa' : 'disputas'} abiertas`}
          </div>
        </div>

        {/* Estado general */}
        <div className={`rounded-2xl border px-4 py-3 ${
          has_problems 
            ? 'border-red-200 bg-red-50' 
            : 'border-green-200 bg-white'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-700">Estado general</div>
              <div className={`mt-1 text-lg font-extrabold ${
                has_problems ? 'text-red-900' : 'text-green-900'
              }`}>
                {has_problems ? 'Tiene problemas' : 'Sin problemas'}
              </div>
            </div>
            <div className={`text-2xl ${has_problems ? 'text-red-600' : 'text-green-600'}`}>
              {has_problems ? '⚠️' : '✓'}
            </div>
          </div>
          <div className={`mt-2 text-xs ${
            has_problems ? 'text-red-800' : 'text-green-800'
          }`}>
            {has_problems 
              ? 'Este vendedor ha tenido cancelaciones, demoras o disputas' 
              : 'Vendedor confiable sin problemas reportados'}
          </div>
        </div>
      </div>
    </div>
  );
}
