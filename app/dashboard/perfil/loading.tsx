import { SkeletonBox } from '@/components/ui/Skeletons';

export default function PerfilLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-2xl space-y-6">
                <SkeletonBox className="h-7 w-28" />
                {/* Avatar + name */}
                <div className="flex items-center gap-4">
                    <SkeletonBox className="h-20 w-20 rounded-full" />
                    <div className="space-y-2 flex-1">
                        <SkeletonBox className="h-5 w-40" />
                        <SkeletonBox className="h-3 w-32" />
                    </div>
                </div>
                {/* Form fields */}
                <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="space-y-1.5">
                            <SkeletonBox className="h-3 w-24" />
                            <SkeletonBox className="h-10 w-full rounded-xl" />
                        </div>
                    ))}
                </div>
                <SkeletonBox className="h-11 w-full rounded-xl" />
            </div>
        </div>
    );
}
