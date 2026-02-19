'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Home, History, Inbox, CalendarDays, User } from 'lucide-react';

export default function BottomNav({ userId, initialCount }: { userId: string, initialCount: number }) {
    const pathname = usePathname();
    const router = useRouter(); // Added for manual navigation if needed
    const supabase = createClient();
    const [pendingCount, setPendingCount] = useState(initialCount);

    // --- HAPTIC FEEDBACK HELPER ---
    const triggerHaptic = () => {
        if (typeof window !== 'undefined' && window.navigator.vibrate) {
            // Short 10ms pulse for a "click" feel
            window.navigator.vibrate(10);
        }
    };

    useEffect(() => {
        const channel = supabase.channel('nav-inbox')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'swap_requests',
                filter: `receiver_id=eq.${userId}`
            }, async () => {
                const { count } = await supabase
                    .from('swap_requests')
                    .select('*', { count: 'exact', head: true })
                    .eq('receiver_id', userId)
                    .eq('status', 'pending');
                setPendingCount(count || 0);
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId, supabase]);

    const navLinks = [
        { href: '/employee', label: 'Home', icon: <Home size={22} /> },
        { href: '/employee/logs', label: 'Logs', icon: <History size={22} /> },
        { href: '/employee/inbox', label: 'Inbox', icon: <Inbox size={22} />, badge: pendingCount },
        { href: '/employee/leave', label: 'Leave', icon: <CalendarDays size={22} /> },
        { href: '/employee/profile', label: 'Profile', icon: <User size={22} /> },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200/50 z-50">
            <div className="max-w-md mx-auto flex items-center justify-around h-20 px-2">
                {navLinks.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={() => triggerHaptic()} // Trigger haptic on click
                            className="flex flex-col items-center justify-center flex-1 h-full relative"
                        >
                            <div className={`transition-all duration-300 relative ${isActive ? 'text-slate-900 translate-y-[-2px]' : 'text-slate-300'}`}>
                                {link.icon}
                                {link.badge ? (
                                    <div className="absolute -top-1 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white">
                                        {link.badge}
                                    </div>
                                ) : null}
                            </div>
                            <span className={`text-[9px] font-black mt-1.5 transition-all uppercase tracking-tighter ${isActive ? 'text-slate-900 opacity-100' : 'text-slate-300 opacity-0 translate-y-1'}`}>
                                {link.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
            {/* Safe area for iPhones with notches */}
            <div className="h-[env(safe-area-inset-bottom,16px)] bg-white/80" />
        </nav>
    );
}