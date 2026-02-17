import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SwapInbox from '@/components/employee/SwapInbox';
import HomeSkeleton from '@/components/HomeSkeleton';

export default async function InboxPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    return (
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <header className="px-6 pt-8 mb-4">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Notifications</p>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Shift Inbox</h1>
            </header>

            <main className="px-2">
                <Suspense fallback={<HomeSkeleton />}>
                    <SwapInbox userId={user.id} />
                </Suspense>
            </main>
        </div>
    );
}