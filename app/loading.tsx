import { SkeletonBox, SkeletonProductCard } from '@/components/ui/Skeletons';

export default function HomeLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
            {/* Promo bar */}
            <div className="h-9 bg-emerald-400 animate-pulse" />

            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-black/5 bg-white">
                <div className="mx-auto max-w-6xl px-4 py-3">
                    <div className="flex items-center gap-4">
                        <SkeletonBox className="h-10 w-24 rounded-xl" />
                        <SkeletonBox className="h-10 flex-1 rounded-2xl" />
                        <div className="hidden sm:flex gap-2">
                            <SkeletonBox className="h-9 w-20 rounded-xl" />
                            <SkeletonBox className="h-9 w-20 rounded-xl" />
                        </div>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-6 space-y-10">
                {/* Hero banner */}
                <SkeletonBox className="h-48 sm:h-64 w-full rounded-3xl" />

                {/* Categories */}
                <div className="flex gap-3 overflow-x-auto">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                            <SkeletonBox className="h-16 w-16 rounded-2xl" />
                            <SkeletonBox className="h-2 w-12" />
                        </div>
                    ))}
                </div>

                {/* Feature cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonBox key={i} className="h-24 w-full rounded-3xl" />
                    ))}
                </div>

                {/* Carousel section 1 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <SkeletonBox className="h-6 w-48" />
                        <SkeletonBox className="h-4 w-20" />
                    </div>
                    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                        <div className="flex gap-4 overflow-hidden">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <SkeletonProductCard key={i} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Carousel section 2 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <SkeletonBox className="h-6 w-40" />
                        <SkeletonBox className="h-4 w-16" />
                    </div>
                    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                        <div className="flex gap-4 overflow-hidden">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <SkeletonProductCard key={i} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Explore grid */}
                <div className="space-y-4">
                    <SkeletonBox className="h-6 w-32" />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                                <SkeletonBox className="h-36 w-full rounded-none" />
                                <div className="p-3 space-y-2">
                                    <SkeletonBox className="h-3 w-full" />
                                    <SkeletonBox className="h-4 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}

