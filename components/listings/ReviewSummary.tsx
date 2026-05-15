'use client';

import StarIcon from '@heroicons/react/20/solid/StarIcon';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

interface ReviewSummaryProps {
  stats: {
    average: number;
    total: number;
    breakdown: Record<string, number>; // "5": 10
    features: { name: string; rating: number }[];
  };
}

export function ReviewSummary({ stats }: ReviewSummaryProps) {
  const { average, total, breakdown, features } = stats;

  return (
    <div>
      <div className="flex items-end gap-2">
        <span className="text-5xl font-extrabold text-blue-600">{average.toFixed(1)}</span>
        <div className="mb-1">
          <div className="flex text-blue-500">
            {[0, 1, 2, 3, 4].map((rating) => (
              <StarIcon
                key={rating}
                className={classNames(
                  average > rating ? 'text-blue-500' : 'text-gray-200',
                  'h-5 w-5 flex-shrink-0'
                )}
                aria-hidden="true"
              />
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">{total} calificaciones</p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = breakdown[rating] || 0;
          const percent = total > 0 ? (count / total) * 100 : 0;
          
          return (
            <div key={rating} className="flex items-center gap-2 text-sm">
              <span className="w-3 text-right text-gray-500">{rating}</span>
              <StarIcon className="h-3 w-3 text-gray-400" />
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="absolute inset-y-0 left-0 bg-gray-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="w-8 text-right text-gray-400">{count}</span>
            </div>
          );
        })}
      </div>

      {features && features.length > 0 && (
        <div className="mt-8 border-t border-gray-100 pt-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Calificación de características</h3>
          <div className="space-y-4">
            {features.map((feature) => (
              <div key={feature.name}>
                <div className="mb-1 flex justify-between text-xs text-gray-600">
                  <span className="capitalize">{feature.name.replace(/_/g, ' ')}</span>
                  {/* Optional: Show number? */}
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <StarIcon
                      key={s}
                      className={classNames(
                        feature.rating >= s ? 'text-blue-500' : 'text-gray-200',
                        'h-4 w-4'
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
