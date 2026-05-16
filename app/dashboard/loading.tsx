import { SkeletonBox, SkeletonStatCard, SkeletonNavRow } from '@/components/ui/Skeletons';

export default function DashboardLoading() {
    return (
        <div className="min-h-screen bg-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <SkeletonBox className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5 flex-1">
                        <SkeletonBox className="h-5 w-40" />
                        <SkeletonBox className="h-3 w-24" />
                    </div>
                </div>

                {/* Balance card */}
                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                    <SkeletonBox className="h-4 w-32" />
                    <SkeletonBox className="h-8 w-40" />
                    <div className="flex gap-4">
                        <SkeletonBox className="h-3 w-24" />
                        <SkeletonBox className="h-3 w-24" />
                    </div>
                </div>

                {/* Stats grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <SkeletonStatCard key={i} />
                    ))}
                </div>

                {/* Nav sections */}
                <div className="space-y-3">
                    <SkeletonBox className="h-3 w-20" />
                    {Array.from({ length: 3 }).map((_, i) => (
                        <SkeletonNavRow key={i} />
                    ))}
                </div>
                <div className="space-y-3">
                    <SkeletonBox className="h-3 w-24" />
                    {Array.from({ length: 3 }).map((_, i) => (
                        <SkeletonNavRow key={i} />
                    ))}
                </div>

                {/* Charts placeholder */}
                <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                    <SkeletonBox className="h-5 w-48" />
                    <SkeletonBox className="h-3 w-64" />
                    <SkeletonBox className="h-48 w-full rounded-2xl" />
                </div>
            </div>
        </div>
    );
}
