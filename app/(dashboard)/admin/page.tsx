// app/(dashboard)/admin/page.tsx
import { Suspense } from 'react';
import LiveStatusList from '@/components/admin/LiveStatusList';
import HomeSkeleton from '@/components/HomeSkeleton';
import AdminPushManager from '@/components/admin/AdminPushManager';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLivePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    return (
        <div className="max-w-6xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Live Presence</h1>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Active Floor Personnel</p>
                </div>
                
                {user && (
                    <div className="w-full md:w-auto">
                        <AdminPushManager userId={user.id} />
                    </div>
                )}
            </header>

            <div className="bg-white border border-slate-100 rounded-[3.5rem] p-10 min-h-[600px] shadow-2xl shadow-slate-200/50">
                <Suspense fallback={<HomeSkeleton />}>
                    <LiveStatusList />
                </Suspense>
            </div>
        </div>
    );
}