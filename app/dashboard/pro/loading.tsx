import { SkeletonBox } from '@/components/ui/Skeletons';

export default function ProLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-6">
                <SkeletonBox className="h-7 w-36" />
                {/* Current plan */}
                <div className="rounded-3xl border border-gray-200 bg-white p-5 space-y-3">
                    <SkeletonBox className="h-5 w-28" />
                    <SkeletonBox className="h-8 w-20" />
                    <SkeletonBox className="h-3 w-48" />
                </div>
                {/* Plan cards */}
                <div className="grid gap-4 sm:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-3xl border border-gray-200 bg-white p-5 space-y-3">
                            <SkeletonBox className="h-5 w-20" />
                            <SkeletonBox className="h-8 w-28" />
                            <div className="space-y-2">
                                {Array.from({ length: 4 }).map((_, j) => (
                                    <SkeletonBox key={j} className="h-3 w-full" />
                                ))}
                            </div>
                            <SkeletonBox className="h-10 w-full rounded-xl" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
