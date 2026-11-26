export default function OperationsSkeleton() {
    return <div role="status" aria-label="Loading store operations" className="space-y-4 motion-safe:animate-pulse"><div className="h-8 w-56 rounded bg-slate-200 dark:bg-slate-800" /><div className="h-28 rounded-xl bg-slate-100 dark:bg-slate-900" /><div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-900" /><span className="sr-only">Loading…</span></div>;
}
