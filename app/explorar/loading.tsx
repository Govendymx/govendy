import { SkeletonBox, SkeletonProductCard } from '@/components/ui/Skeletons';

export default function ExplorarLoading() {
    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-black/5 bg-white">
                <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
                    <SkeletonBox className="h-10 w-24 rounded-xl" />
                    <SkeletonBox className="h-10 flex-1 rounded-2xl" />
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <SkeletonBox key={i} className="h-9 w-24 rounded-full shrink-0" />
                    ))}
                </div>

                {/* Product grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {Array.from({ length: 15 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                            <SkeletonBox className="h-40 w-full rounded-none" />
                            <div className="p-3 space-y-2">
                                <SkeletonBox className="h-3 w-full" />
                                <SkeletonBox className="h-4 w-1/2" />
                                <SkeletonBox className="h-3 w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

