import { SkeletonBox } from '@/components/ui/Skeletons';

export default function LiveDashboardLoading() {
    return (
        <div className="min-h-screen bg-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-5">
                {/* Banner */}
                <SkeletonBox className="h-48 w-full rounded-2xl" />
                {/* Title + status */}
                <div className="flex items-center justify-between">
                    <SkeletonBox className="h-7 w-40" />
                    <SkeletonBox className="h-6 w-24 rounded-full" />
                </div>
                {/* Hours remaining */}
                <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                    <SkeletonBox className="h-4 w-32" />
                    <SkeletonBox className="h-8 w-20" />
                    <SkeletonBox className="h-3 w-48" />
                </div>
                {/* Form */}
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <SkeletonBox className="h-3 w-20" />
                        <SkeletonBox className="h-10 w-full rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                        <SkeletonBox className="h-3 w-24" />
                        <SkeletonBox className="h-20 w-full rounded-xl" />
                    </div>
                </div>
                {/* Camera preview */}
                <SkeletonBox className="aspect-video w-full rounded-xl" />
                {/* Action button */}
                <SkeletonBox className="h-12 w-full rounded-xl" />
            </div>
        </div>
    );
}
