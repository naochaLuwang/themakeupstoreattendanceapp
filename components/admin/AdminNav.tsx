'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Zap, Calendar, Palmtree, AlertOctagon, LogOut, Search,
    RefreshCcw, Eye, CreditCard, BarChart3, Clock, ShieldCheck,
    MoreHorizontal, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminNav() {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Mapped from your project folder structure
    const links = [
        { href: '/admin', label: 'Live', icon: <Zap size={18} />, mobile: true },
        { href: '/admin/logs', label: 'Attendance', icon: <Search size={18} />, mobile: true },
        { href: '/admin/schedule', label: 'Planner', icon: <Calendar size={18} />, mobile: true },
        { href: '/admin/weekoff-request', label: 'Weekoffs', icon: <RefreshCcw size={18} />, mobile: true },
        { href: '/admin/leaves', label: 'Leaves', icon: <Palmtree size={18} />, mobile: false },
        { href: '/admin/oversight', label: 'Oversight', icon: <ShieldCheck size={18} />, mobile: false },
        { href: '/admin/payroll', label: 'Payroll', icon: <CreditCard size={18} />, mobile: false },
        { href: '/admin/reports/hours', label: 'Hours', icon: <Clock size={18} />, mobile: false },
        { href: '/admin/reports/reliability', label: 'Reliability', icon: <BarChart3 size={18} />, mobile: false },
        { href: '/admin/overrides', label: 'Alerts', icon: <AlertOctagon size={18} />, mobile: false },
        { href: '/admin/roaster', label: 'Calendar', icon: <Calendar size={18} />, mobile: false },
    ];

    const primaryLinks = links.filter(l => l.mobile);
    const secondaryLinks = links.filter(l => !l.mobile);

    return (
        <>
            {/* --- DESKTOP SIDEBAR --- */}
            <aside className="hidden lg:flex w-80 bg-white border-r border-slate-200 p-8 flex-col sticky top-0 h-screen shrink-0 overflow-y-auto">
                <div className="mb-8 px-2">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-slate-200">
                        <Zap className="text-white fill-current" size={24} />
                    </div>
                    <h2 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">ADMIN</h2>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mt-2">Daciana Stationery</p>
                </div>

                <nav className="flex flex-col gap-1 w-full">
                    {links.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all group
                                    ${isActive ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'}`}
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
                        <button className="flex items-center gap-4 px-5 py-4 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 w-full rounded-2xl transition-all">
                            <LogOut size={18} />
                            Sign Out
                        </button>
                    </form>
                </div>
            </aside>

            {/* --- MOBILE BOTTOM TAB BAR --- */}
            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 px-6 pb-8 pt-3 flex justify-between items-center z-[100] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                {primaryLinks.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                        <Link key={link.href} href={link.href} className={`flex flex-col items-center gap-1 ${isActive ? 'text-slate-900' : 'text-slate-300'}`}>
                            <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-slate-900 text-white shadow-md' : ''}`}>
                                {link.icon}
                            </div>
                            <span className="text-[7px] font-black uppercase tracking-tighter">{link.label}</span>
                        </Link>
                    );
                })}

                {/* Mobile "More" Trigger */}
                <button
                    onClick={() => setIsMenuOpen(true)}
                    className="flex flex-col items-center gap-1 text-slate-300"
                >
                    <div className="p-2 rounded-xl">
                        <MoreHorizontal size={18} />
                    </div>
                    <span className="text-[7px] font-black uppercase tracking-tighter">More</span>
                </button>
            </nav>

            {/* --- MOBILE MORE DRAWER --- */}
            <AnimatePresence>
                {isMenuOpen && (
                    <div className="fixed inset-0 z-[200] lg:hidden">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setIsMenuOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[3rem] p-8 pb-12 shadow-2xl"
                        >
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Management</h3>
                                <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20} /></button>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                {secondaryLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setIsMenuOpen(false)}
                                        className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group active:bg-slate-100 transition-all"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="text-slate-400 group-active:text-slate-900">{link.icon}</div>
                                            <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{link.label}</span>
                                        </div>
                                        <ChevronRight size={14} className="text-slate-300" />
                                    </Link>
                                ))}
                            </div>

                            <form action="/signout" method="post" className="mt-6 pt-6 border-t border-slate-100">
                                <button className="w-full flex items-center justify-center gap-3 py-4 bg-rose-50 text-rose-500 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
                                    <LogOut size={16} /> Sign Out of Admin
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}