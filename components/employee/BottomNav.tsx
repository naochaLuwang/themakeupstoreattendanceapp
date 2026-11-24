'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Home, History, Inbox, CalendarDays, User } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import AppBrand from '@/components/AppBrand';
import { WORKSPACE_NAME } from '@/lib/branding';
import { nativeFeedback, isNativeWorkspace } from '@/lib/native/experience';

export default function BottomNav({ userId, initialCount }: { userId: string, initialCount: number }) {
    const pathname = usePathname();
    const supabase = createClient();
    const [pendingCount, setPendingCount] = useState(initialCount);

    const triggerHaptic = () => {
        if (isNativeWorkspace()) nativeFeedback('selection');
        else navigator.vibrate?.(10);
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
        { href: '/employee', label: 'Home', icon: <Home size={20} strokeWidth={1.5} /> },
        { href: '/employee/logs', label: 'Logs', icon: <History size={20} strokeWidth={1.5} /> },
        { href: '/employee/inbox', label: 'Inbox', icon: <Inbox size={20} strokeWidth={1.5} />, badge: pendingCount },
        { href: '/employee/leave', label: 'Leave', icon: <CalendarDays size={20} strokeWidth={1.5} /> },
        { href: '/employee/profile', label: 'Profile', icon: <User size={20} strokeWidth={1.5} /> },
    ];

    return (
        <nav aria-label="Employee navigation" className="employee-nav">
            <div className="employee-nav-inner">
                <Link href="/employee" className="employee-nav-brand" aria-label={`${WORKSPACE_NAME} — staff home`}>
                    <AppBrand subtitle="Staff workspace" />
                </Link>
                <div className="employee-nav-links">
                    {navLinks.map(link => {
                        const isActive = pathname === link.href || (link.href === '/employee/profile' && pathname === '/employee/payslips');
                        return (
                            <Link key={link.href} href={link.href} onClick={triggerHaptic} data-native-feedback="explicit"
                                aria-current={isActive ? 'page' : undefined} className="employee-nav-link">
                                <span className="employee-nav-icon" aria-hidden="true">
                                    {link.icon}
                                    {link.badge ? <span className="employee-nav-count">{link.badge > 99 ? '99+' : link.badge}</span> : null}
                                </span>
                                <span>{link.label}</span>
                                {link.badge ? <span className="sr-only">, {link.badge} pending requests</span> : null}
                            </Link>
                        );
                    })}
                </div>
                <div className="employee-theme-desktop"><ThemeToggle /></div>
            </div>
        </nav>
    );
}
