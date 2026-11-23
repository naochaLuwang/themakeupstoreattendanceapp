'use client';

import { RefreshCw } from 'lucide-react';

export default function WorkspaceError({ reset }: { reset: () => void }) {
    return (
        <div role="alert" className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
            <h1 className="text-2xl font-medium text-slate-900">This page couldn’t load</h1>
            <p className="mt-2 text-sm text-slate-500">Please try again. If the problem continues, return to this page in a moment.</p>
            <button type="button" onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white">
                <RefreshCw size={16} aria-hidden="true" /> Try again
            </button>
        </div>
    );
}
