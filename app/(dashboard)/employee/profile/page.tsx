import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { User, Clock, LogOut, ChevronRight } from 'lucide-react';

export default async function ProfilePage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    return (
        <div className="px-6 pt-10 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4 px-2">
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xl font-black uppercase">
                    {profile?.full_name?.[0]}
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-900">{profile?.full_name}</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                        {profile?.role} • Staff
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                <div className="w-full flex items-center justify-between px-6 py-5 hover:bg-slate-50 border-b border-slate-50">
                    <div className="flex items-center gap-4 text-slate-700">
                        <User size={18} />
                        <span className="text-sm font-bold text-slate-900">Personal Info</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                </div>

                <form action="/signout" method="post">
                    <button className="w-full flex items-center gap-4 px-6 py-6 text-rose-500 hover:bg-rose-50 transition-colors">
                        <LogOut size={18} />
                        <span className="text-sm font-black uppercase tracking-widest">Sign Out</span>
                    </button>
                </form>
            </div>
        </div>
    );
}