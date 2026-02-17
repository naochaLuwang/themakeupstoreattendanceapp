import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import OverridesList from '@/components/admin/OverridesList';
import HomeSkeleton from '@/components/HomeSkeleton';

export default async function AdminOverridesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <header>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter">System Overrides</h1>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Critical alerts & clock-in fixes</p>
            </header>

            <section className="bg-white border border-slate-200 rounded-[3rem] p-8 md:p-12 min-h-[400px] shadow-xl shadow-slate-100/50">
                <Suspense fallback={<HomeSkeleton />}>
                    <OverridesList adminId={user.id} />
                </Suspense>
            </section>
        </div>
    );
}