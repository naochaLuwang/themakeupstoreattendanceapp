import { createClient } from '@/lib/supabase/server';
import ActivityLogView from '@/components/employee/ActivityLogViews';
import { redirect } from 'next/navigation';

export default async function LogsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    return (
        <div className="animate-in fade-in duration-500">
            <header className="p-6 pb-0">
                <h1 className="text-2xl font-black text-slate-900 uppercase">Work Logs</h1>
                <p className="text-xs font-bold text-slate-400">History of your clock-ins</p>
            </header>
            <ActivityLogView userId={user.id} />
        </div>
    );
}