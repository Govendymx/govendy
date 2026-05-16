import { SkeletonBox } from '@/components/ui/Skeletons';

export default function FavoritosLoading() {
    return (
        <div className="min-h-screen bg-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-3xl space-y-5">
                <SkeletonBox className="h-7 w-32" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
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
        </div>
    );
}
