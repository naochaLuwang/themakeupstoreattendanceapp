import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import OverridesList from '@/components/admin/OverridesList';
import HomeSkeleton from '@/components/HomeSkeleton';
import AdminShiftCalendar from '@/components/admin/AdminShiftCalendar';

export default async function RoasterPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-3xl font-medium text-slate-900 tracking-normal">Shift calendar</h1>
                <p className="text-sm font-medium text-slate-500 tracking-normal mt-1">Review assigned shifts and staff availability</p>
            </header>

            <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6">
                <Suspense fallback={<HomeSkeleton />}>
                    <AdminShiftCalendar />
                </Suspense>
            </section>
        </div>
    );
}
