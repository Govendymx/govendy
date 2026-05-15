import { SkeletonBox, SkeletonOrderCard } from '@/components/ui/Skeletons';

export default function VentasLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <SkeletonBox className="h-7 w-36" />
                    <SkeletonBox className="h-9 w-24 rounded-xl" />
                </div>

                {/* Search */}
                <SkeletonBox className="h-10 w-full rounded-2xl" />

                {/* Filter chips */}
                <div className="flex gap-2 overflow-x-auto">
                    {Array.from({ length: 7 }).map((_, i) => (
                        <SkeletonBox key={i} className="h-8 w-20 rounded-full shrink-0" />
                    ))}
                </div>

                {/* Order cards */}
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonOrderCard key={i} />
                    ))}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-center gap-2">
                    <SkeletonBox className="h-8 w-8 rounded-lg" />
                    <SkeletonBox className="h-4 w-16" />
                    <SkeletonBox className="h-8 w-8 rounded-lg" />
                </div>
            </div>
        </div>
    );
}
