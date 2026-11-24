// app/(dashboard)/admin/page.tsx
import { Suspense } from 'react';
import LiveStatusList from '@/components/admin/LiveStatusList';
import AdminPageSkeleton from '@/components/admin/AdminPageSkeleton';
import { WORKSPACE_NAME } from '@/lib/branding';

export default async function AdminLivePage() {
    return (
        <div className="space-y-8">
            <header className="flex flex-col xl:flex-row justify-between items-start gap-6">
                <div>
                    <p className="text-xs text-slate-500 mb-3">{WORKSPACE_NAME}</p>
                    <h1 className="text-3xl font-medium text-slate-900">Live presence</h1>
                    <p className="text-sm text-slate-500 mt-2">Who’s on the floor, their shifts, and attendance updates</p>
                </div>

            </header>

            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
                <Suspense fallback={<AdminPageSkeleton />}>
                    <LiveStatusList />
                </Suspense>
            </div>
        </div>
    );
}
