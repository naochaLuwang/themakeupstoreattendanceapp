import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { User, LogOut, ChevronRight, ShieldCheck, FileText } from 'lucide-react';
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
        <div className="space-y-6">

            <header>
                <h1 className="text-3xl font-medium text-slate-900">Profile</h1>
                <p className="mt-2 text-sm text-slate-500">Your details, password, and payslips</p>
            </header>
            {/* High-Design Profile Header */}
            <div className="flex items-center gap-4">
                <div className="employee-profile-avatar">
                    {profile?.full_name?.[0] || 'U'}
                </div>
                <div className="pb-2 overflow-hidden">
                    <h3 className="text-xl md:text-2xl font-medium text-slate-900 leading-tight truncate">
                        {profile?.full_name}
                    </h3>
                    <p className="text-black/30 text-xs md:text-sm font-medium tracking-normal mt-1 truncate">
                        {profile?.role || 'Staff'}
                    </p>
                </div>
            </div>

            {/* Action Grid using native Details/Summary for accordions */}
            <div className="bg-white rounded-xl md:rounded-xl border border-neutral-100 overflow-hidden">

                {/* Personal details Section */}
                <details className="group border-b border-neutral-50 outline-none">
                    <summary className="flex items-center justify-between px-4 sm:px-5 py-4 hover:bg-neutral-50 transition-colors cursor-pointer list-none outline-none">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center  transition-colors duration-300">
                                <User size={18} />
                            </div>
                            <span className="text-sm font-medium tracking-normal text-slate-900">Personal details</span>
                        </div>
                        <ChevronRight size={16} className="text-slate-500 group-open:rotate-90 transition-transform duration-300" />
                    </summary>
                    <div className="px-4 sm:px-5 overflow-hidden">
                        <PersonalDataForm initialName={profile?.full_name || ''} userId={user.id} />
                    </div>
                </details>

                {/* Security Section */}
                <details className="group border-b border-neutral-50 outline-none">
                    <summary className="flex items-center justify-between px-4 sm:px-5 py-4 hover:bg-neutral-50 transition-colors cursor-pointer list-none outline-none">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-neutral-50 flex items-center justify-center  transition-colors duration-300">
                                <ShieldCheck size={18} />
                            </div>
                            <span className="text-sm font-medium tracking-normal text-slate-900">Change password</span>
                        </div>
                        <ChevronRight size={16} className="text-slate-500 group-open:rotate-90 transition-transform duration-300" />
                    </summary>
                    <div className="px-4 sm:px-5 overflow-hidden">
                        <SecurityForm />
                    </div>
                </details>

                {/* Highly Visible Payslips Archive Link */}
                <Link href="/employee/payslips" className="flex items-center justify-between px-4 sm:px-5 py-4 hover:bg-neutral-50 transition-colors cursor-pointer list-none outline-none border-b border-neutral-50 group">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center  text-indigo-500 transition-colors duration-300 shadow-sm">
                            <FileText size={18} />
                        </div>
                        <span className="text-sm font-medium tracking-normal text-slate-900">Payslips</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-500 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>

                <form action="/signout" method="post">
                    <button className="w-full flex items-center gap-3 px-4 sm:px-5 py-4 text-rose-500 hover:bg-rose-50/50 transition-colors group outline-none">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center  transition-colors">
                            <LogOut size={18} />
                        </div>
                        <span className="text-sm font-medium tracking-normal">Sign out</span>
                    </button>
                </form>
            </div>

        </div>
    );
}
