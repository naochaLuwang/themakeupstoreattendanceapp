// app/(dashboard)/admin/page.tsx
import { Suspense } from 'react';
import LiveStatusList from '@/components/admin/LiveStatusList';
import HomeSkeleton from '@/components/HomeSkeleton';

export default function AdminLivePage() {
    return (
        <div className="max-w-6xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Live Presence</h1>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Active Floor Personnel</p>
                </div>
                <div className="px-6 py-3 bg-white border border-slate-100 shadow-sm text-emerald-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    System Live
                </div>
            </header>

            <div className="bg-white border border-slate-100 rounded-[3.5rem] p-10 min-h-[600px] shadow-2xl shadow-slate-200/50">
                <Suspense fallback={<HomeSkeleton />}>
                    <LiveStatusList />
                </Suspense>
            </div>
        </div>
    );
}