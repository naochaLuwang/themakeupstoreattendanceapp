'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Zap, Calendar, Palmtree, AlertOctagon, LogOut, Search } from 'lucide-react';

export default function AdminNav() {
    const pathname = usePathname();

    const links = [
        { href: '/admin', label: 'Live', icon: <Zap size={18} /> },
        { href: '/admin/logs', label: 'Attendance', icon: <Search size={18} /> },
        { href: '/admin/schedule', label: 'Planner', icon: <Calendar size={18} /> },
        { href: '/admin/leaves', label: 'Leaves', icon: <Palmtree size={18} /> },
        { href: '/admin/overrides', label: 'Alerts', icon: <AlertOctagon size={18} /> },
        { href: '/admin/roaster', label: 'Calendar', icon: <Calendar size={18} /> },

    ];

    return (
        <>
            {/* --- DESKTOP SIDEBAR --- */}
            <aside className="hidden lg:flex w-80 bg-white border-r border-slate-200 p-8 flex-col sticky top-0 h-screen shrink-0">
                <div className="mb-12 px-2">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-slate-200">
                        <Zap className="text-white fill-current" size={24} />
                    </div>
                    <h2 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">ADMIN</h2>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-2">The Makeup Store</p>
                </div>

                <nav className="flex flex-col gap-2 w-full">
                    {links.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all group
                                    ${isActive ? 'bg-slate-900 text-white shadow-2xl shadow-slate-300' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'}`}
                            >
                                <span className={isActive ? 'text-blue-400' : 'text-slate-300 group-hover:text-slate-900'}>
                                    {link.icon}
                                </span>
                                {link.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="mt-auto pt-6 border-t border-slate-50">
                    <form action="/signout" method="post">
                        <button className="flex items-center gap-4 px-5 py-4 text-rose-500 font-black text-[11px] uppercase tracking-widest hover:bg-rose-50 w-full rounded-2xl transition-all">
                            <LogOut size={18} />
                            Sign Out
                        </button>
                    </form>
                </div>
            </aside>

            {/* --- MOBILE BOTTOM TAB BAR --- */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 px-6 pb-8 pt-3 flex justify-between items-center z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                {links.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex flex-col items-center gap-1.5 transition-all ${isActive ? 'text-slate-900 scale-110' : 'text-slate-300'}`}
                        >
                            <div className={`p-2.5 rounded-xl transition-all ${isActive ? 'bg-slate-900 text-white shadow-lg' : ''}`}>
                                {link.icon}
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-tighter">
                                {link.label}
                            </span>
                        </Link>
                    );
                })}
                {/* Mobile Logout (Small Icon) */}
                <form action="/signout" method="post">
                    <button className="flex flex-col items-center gap-1.5 text-rose-400 p-2.5">
                        <LogOut size={18} />
                        <span className="text-[8px] font-black uppercase tracking-tighter">Exit</span>
                    </button>
                </form>
            </nav>
        </>
    );
}