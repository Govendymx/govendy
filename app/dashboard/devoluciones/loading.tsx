import { SkeletonBox } from '@/components/ui/Skeletons';

/** Generic dashboard page skeleton for simple list/Q&A pages */
export default function DashboardGenericLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-4">
                <SkeletonBox className="h-7 w-36" />
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4">
                        <SkeletonBox className="h-10 w-10 rounded-xl shrink-0" />
                        <div className="flex-1 space-y-2">
                            <SkeletonBox className="h-4 w-3/4" />
                            <SkeletonBox className="h-3 w-1/2" />
                            <SkeletonBox className="h-3 w-1/3" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
