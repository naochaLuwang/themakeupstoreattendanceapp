export default function WorkspaceSkeleton() {
    return (
        <div role="status" aria-label="Loading workspace" className="space-y-6 motion-safe:animate-pulse">
            <span className="sr-only">Loading workspace</span>
            <div aria-hidden="true" className="space-y-3">
                <div className="h-8 w-48 rounded-lg bg-slate-200" />
                <div className="h-4 w-64 max-w-full rounded bg-slate-100" />
            </div>
            <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map(item => (
                    <div key={item} className="h-40 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                        <div className="h-4 w-24 rounded bg-slate-100" />
                        <div className="h-8 w-16 rounded bg-slate-200" />
                        <div className="h-4 w-32 rounded bg-slate-100" />
                    </div>
                ))}
            </div>
        </div>
    );
}
