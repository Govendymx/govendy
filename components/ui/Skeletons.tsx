/* Skeleton primitives — reusable pulse blocks for loading.tsx files */
export function SkeletonBox({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse rounded-xl bg-gray-200 ${className}`} />;
}

export function SkeletonCircle({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse rounded-full bg-gray-200 ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className="animate-pulse rounded bg-gray-200 h-3"
                    style={{ width: i === lines - 1 ? '60%' : '100%' }}
                />
            ))}
        </div>
    );
}

/** Order card skeleton — used in compras & ventas */
export function SkeletonOrderCard() {
    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
                <SkeletonBox className="h-16 w-16 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                    <SkeletonBox className="h-4 w-3/4" />
                    <SkeletonBox className="h-3 w-1/2" />
                </div>
                <SkeletonBox className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
                <SkeletonBox className="h-3 w-24" />
                <SkeletonBox className="h-3 w-16" />
            </div>
        </div>
    );
}

/** Product card skeleton — used in home & explore carousels */
export function SkeletonProductCard() {
    return (
        <div className="w-56 shrink-0 snap-start rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-sm">
            <SkeletonBox className="h-40 w-full rounded-none" />
            <div className="p-3 space-y-2">
                <SkeletonBox className="h-3 w-full" />
                <SkeletonBox className="h-4 w-1/2" />
            </div>
        </div>
    );
}

/** Stat card skeleton — used in dashboard overview */
export function SkeletonStatCard() {
    return (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 space-y-2">
            <SkeletonBox className="h-2.5 w-20" />
            <SkeletonBox className="h-7 w-16" />
            <SkeletonBox className="h-2.5 w-12" />
        </div>
    );
}

/** Nav/menu row skeleton */
export function SkeletonNavRow() {
    return <SkeletonBox className="h-12 w-full rounded-2xl" />;
}
