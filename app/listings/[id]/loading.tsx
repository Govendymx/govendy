import { SkeletonBox, SkeletonText } from '@/components/ui/Skeletons';

export default function ListingDetailLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-black/5 bg-white">
                <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
                    <SkeletonBox className="h-10 w-24 rounded-xl" />
                    <SkeletonBox className="h-10 flex-1 rounded-2xl" />
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-6">
                <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
                    {/* Image gallery */}
                    <div className="space-y-3">
                        <SkeletonBox className="aspect-square w-full rounded-2xl" />
                        <div className="flex gap-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <SkeletonBox key={i} className="h-16 w-16 rounded-xl shrink-0" />
                            ))}
                        </div>
                    </div>

                    {/* Product info panel */}
                    <div className="space-y-4">
                        {/* Condition badge */}
                        <SkeletonBox className="h-5 w-16 rounded-full" />
                        {/* Title */}
                        <SkeletonBox className="h-6 w-full" />
                        <SkeletonBox className="h-6 w-3/4" />
                        {/* Price */}
                        <SkeletonBox className="h-10 w-40" />
                        {/* Shipping */}
                        <SkeletonBox className="h-5 w-48" />
                        {/* Seller */}
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <SkeletonBox className="h-10 w-10 rounded-full" />
                                <div className="space-y-1.5 flex-1">
                                    <SkeletonBox className="h-4 w-32" />
                                    <SkeletonBox className="h-3 w-20" />
                                </div>
                            </div>
                        </div>
                        {/* Buttons */}
                        <SkeletonBox className="h-12 w-full rounded-2xl" />
                        <SkeletonBox className="h-12 w-full rounded-2xl" />
                    </div>
                </div>

                {/* Description */}
                <div className="mt-8 space-y-4">
                    <SkeletonBox className="h-6 w-32" />
                    <SkeletonText lines={5} />
                </div>
            </main>
        </div>
    );
}
