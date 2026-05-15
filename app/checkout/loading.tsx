import { SkeletonBox } from '@/components/ui/Skeletons';

export default function CheckoutLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-6">
                <SkeletonBox className="h-7 w-36" />
                {/* Items */}
                <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <SkeletonBox className="h-16 w-16 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-2">
                                <SkeletonBox className="h-4 w-3/4" />
                                <SkeletonBox className="h-3 w-1/3" />
                            </div>
                            <SkeletonBox className="h-5 w-16" />
                        </div>
                    ))}
                </div>
                {/* Shipping */}
                <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                    <SkeletonBox className="h-4 w-24" />
                    <SkeletonBox className="h-10 w-full rounded-xl" />
                    <SkeletonBox className="h-10 w-full rounded-xl" />
                </div>
                {/* Summary */}
                <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
                    <div className="flex justify-between"><SkeletonBox className="h-3 w-20" /><SkeletonBox className="h-3 w-16" /></div>
                    <div className="flex justify-between"><SkeletonBox className="h-3 w-16" /><SkeletonBox className="h-3 w-16" /></div>
                    <div className="flex justify-between"><SkeletonBox className="h-5 w-12" /><SkeletonBox className="h-5 w-20" /></div>
                </div>
                <SkeletonBox className="h-12 w-full rounded-xl" />
            </div>
        </div>
    );
}
