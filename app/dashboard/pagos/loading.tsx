import { SkeletonBox } from '@/components/ui/Skeletons';

export default function PagosLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-5">
                <SkeletonBox className="h-7 w-32" />
                {/* Balance cards */}
                <div className="grid gap-4 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 space-y-2">
                            <SkeletonBox className="h-3 w-20" />
                            <SkeletonBox className="h-7 w-28" />
                        </div>
                    ))}
                </div>
                {/* Actions */}
                <div className="flex gap-3">
                    <SkeletonBox className="h-10 w-32 rounded-xl" />
                    <SkeletonBox className="h-10 w-32 rounded-xl" />
                </div>
                {/* Table rows */}
                <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonBox key={i} className="h-14 w-full rounded-xl" />
                    ))}
                </div>
            </div>
        </div>
    );
}
