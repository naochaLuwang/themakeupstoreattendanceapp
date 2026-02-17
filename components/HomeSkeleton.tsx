export default function HomeSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Top Card Skeleton */}
            <div className="h-40 bg-slate-200 rounded-[2.5rem] w-full" />

            {/* Grid Skeletons */}
            <div className="grid grid-cols-2 gap-4">
                <div className="h-32 bg-slate-100 rounded-3xl" />
                <div className="h-32 bg-slate-100 rounded-3xl" />
            </div>

            {/* List Skeletons */}
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-slate-50 rounded-2xl w-full flex items-center px-4 gap-4">
                        <div className="w-10 h-10 bg-slate-200 rounded-xl" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3 bg-slate-200 rounded w-1/3" />
                            <div className="h-2 bg-slate-200 rounded w-1/4" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}