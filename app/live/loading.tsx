import { SkeletonBox } from '@/components/ui/Skeletons';

export default function LiveLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
            <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
                <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
                    <SkeletonBox className="h-10 w-24 rounded-xl" />
                    <SkeletonBox className="h-10 flex-1 rounded-2xl" />
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
                <SkeletonBox className="h-7 w-36" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                            <SkeletonBox className="aspect-video w-full rounded-none" />
                            <div className="p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <SkeletonBox className="h-8 w-8 rounded-full" />
                                    <SkeletonBox className="h-4 w-24" />
                                </div>
                                <SkeletonBox className="h-3 w-3/4" />
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
