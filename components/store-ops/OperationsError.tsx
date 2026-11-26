'use client';
export default function OperationsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <div role="alert" className="rounded-xl border p-6"><h2 className="text-lg font-medium">Store operations could not be loaded</h2><p className="mt-2 text-sm">Check your connection and try again.</p><button type="button" onClick={reset} className="mt-4 rounded-lg border px-4 py-2">Try again</button></div>;
}
