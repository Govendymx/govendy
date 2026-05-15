import { SkeletonBox } from '@/components/ui/Skeletons';

export default function ListingsLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-5">
                <div className="flex items-center justify-between">
                    <SkeletonBox className="h-7 w-44" />
                    <SkeletonBox className="h-9 w-28 rounded-xl" />
                </div>
                <SkeletonBox className="h-10 w-full rounded-2xl" />
                <div className="flex gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonBox key={i} className="h-8 w-20 rounded-full shrink-0" />
                    ))}
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3">
                            <SkeletonBox className="h-16 w-16 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-2">
                                <SkeletonBox className="h-4 w-3/4" />
                                <SkeletonBox className="h-3 w-1/3" />
                            </div>
                            <SkeletonBox className="h-6 w-16 rounded-full" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
