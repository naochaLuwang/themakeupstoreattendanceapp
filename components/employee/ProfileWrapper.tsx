import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { User, LogOut, ChevronRight, ShieldCheck } from 'lucide-react';

export default async function ProfileWrapper() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return (
        <div className="p-6 md:p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-700">
            {/* High-Design Profile Header */}
            <div className="flex items-end gap-6 px-2">
                <div className="w-24 h-24 bg-black rounded-[2.5rem] flex items-center justify-center text-white text-3xl font-black uppercase shadow-2xl shadow-black/20">
                    {profile?.full_name?.[0]}
                </div>
                <div className="pb-2">
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">
                        {profile?.full_name}
                    </h3>
                    <p className="text-black/30 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
                        {profile?.role} // Staff_ID_{user.id.slice(0, 5)}
                    </p>
                </div>
            </div>

            {/* Action Grid */}
            <div className="bg-white rounded-[3rem] border border-neutral-100 overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)]">
                <div className="group flex items-center justify-between px-8 py-7 hover:bg-neutral-50 transition-colors cursor-pointer border-b border-neutral-50">
                    <div className="flex items-center gap-5">
                        <div className="w-10 h-10 rounded-2xl bg-neutral-50 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
                            <User size={18} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-900">Personal Data</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                </div>

                <div className="group flex items-center justify-between px-8 py-7 hover:bg-neutral-50 transition-colors cursor-pointer border-b border-neutral-50">
                    <div className="flex items-center gap-5">
                        <div className="w-10 h-10 rounded-2xl bg-neutral-50 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all">
                            <ShieldCheck size={18} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-900">Security</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                </div>

                <form action="/signout" method="post">
                    <button className="w-full flex items-center gap-5 px-8 py-8 text-rose-500 hover:bg-rose-50/50 transition-all group">
                        <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-all">
                            <LogOut size={18} />
                        </div>
                        <span className="text-xs font-black uppercase tracking-[0.3em]">Terminate Session</span>
                    </button>
                </form>
            </div>

            {/* Systematic Footer Info */}
            <div className="px-8 flex justify-between items-center opacity-20">
                <p className="text-[8px] font-black uppercase tracking-[0.5em]">Auth_Status: Verified</p>
                <p className="text-[8px] font-black uppercase tracking-[0.5em]">v2.6.0</p>
            </div>
        </div>
    );
}