export default function Loading() {
    return (
        <div className="px-6 pt-6 pb-24 max-w-md mx-auto bg-slate-50 min-h-screen">
            {/* Header Skeleton */}
            <header className="mb-8 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-2 w-20 bg-slate-200 animate-pulse rounded" />
                        <div className="h-8 w-32 bg-slate-200 animate-pulse rounded-xl" />
                    </div>
                    <div className="h-12 w-12 bg-slate-200 animate-pulse rounded-2xl" />
                </div>
                <div className="h-14 w-full bg-slate-200 animate-pulse rounded-2xl" />
            </header>

            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-2 gap-3 mb-8">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 w-full bg-white border border-slate-100 rounded-[2rem] animate-pulse" />
                ))}
            </div>

            {/* Logs List Skeleton */}
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-40 w-full bg-white border border-slate-100 rounded-[2.5rem] animate-pulse" />
                ))}
            </div>
        </div>
    );
}