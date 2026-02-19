import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { User, LogOut, ChevronRight, ShieldCheck } from 'lucide-react';
import { PersonalDataForm, SecurityForm } from '@/components/employee/ProfileForm';

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
        <div className="p-6 md:p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-700 max-w-2xl mx-auto">

            {/* High-Design Profile Header */}
            <div className="flex items-end gap-6 px-2">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-black rounded-[2.2rem] md:rounded-[2.5rem] flex items-center justify-center text-white text-3xl font-black uppercase shadow-2xl shadow-black/20 shrink-0">
                    {profile?.full_name?.[0] || 'U'}
                </div>
                <div className="pb-2 overflow-hidden">
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-tight truncate">
                        {profile?.full_name}
                    </h3>
                    <p className="text-black/30 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mt-1 truncate">
                        {profile?.role || 'Staff'}
                    </p>
                </div>
            </div>

            {/* Action Grid using native Details/Summary for accordions */}
            <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] border border-neutral-100 overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.05)]">

                {/* Personal Data Section */}
                <details className="group border-b border-neutral-50 outline-none">
                    <summary className="flex items-center justify-between px-8 py-7 hover:bg-neutral-50 transition-colors cursor-pointer list-none outline-none">
                        <div className="flex items-center gap-5">
                            <div className="w-10 h-10 rounded-2xl bg-neutral-50 flex items-center justify-center group-open:bg-black group-open:text-white transition-all duration-300">
                                <User size={18} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Personal Data</span>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 group-open:rotate-90 transition-transform duration-300" />
                    </summary>
                    <div className="px-8 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <PersonalDataForm initialName={profile?.full_name || ''} userId={user.id} />
                    </div>
                </details>

                {/* Security Section */}
                <details className="group border-b border-neutral-50 outline-none">
                    <summary className="flex items-center justify-between px-8 py-7 hover:bg-neutral-50 transition-colors cursor-pointer list-none outline-none">
                        <div className="flex items-center gap-5">
                            <div className="w-10 h-10 rounded-2xl bg-neutral-50 flex items-center justify-center group-open:bg-black group-open:text-white transition-all duration-300">
                                <ShieldCheck size={18} />
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-900">Change Password</span>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 group-open:rotate-90 transition-transform duration-300" />
                    </summary>
                    <div className="px-8 overflow-hidden animate-in fade-in slide-in-from-top-2">
                        <SecurityForm />
                    </div>
                </details>

                <form action="/signout" method="post">
                    <button className="w-full flex items-center gap-5 px-8 py-8 text-rose-500 hover:bg-rose-50/50 transition-all group outline-none">
                        <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-all">
                            <LogOut size={18} />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.3em]">Sign Out</span>
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