'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import AppBrand from '@/components/AppBrand';
import { WORKSPACE_NAME } from '@/lib/branding';
import {
    Activity, Calendar, Palmtree, LogOut, Search, RefreshCcw,
    CreditCard, BarChart3, QrCode, Bell, ShieldCheck, MoreHorizontal, X, MapPin, Store, Users,
} from 'lucide-react';

const links = [
    { href: '/admin', label: 'Live presence', mobileLabel: 'Live', icon: Activity },
    { href: '/admin/logs', label: 'Attendance', mobileLabel: 'Attendance', icon: Search },
    { href: '/admin/schedule', label: 'Shift planner', mobileLabel: 'Planner', icon: Calendar },
    { href: '/admin/store-operations', label: 'Store operations', mobileLabel: 'Store', icon: Store },
    { href: '/admin/employees', label: 'Employees', icon: Users, adminOnly: true },
    { href: '/admin/attendance-stations', label: 'Attendance stations', icon: QrCode },
    { href: '/admin/attendance-notifications', label: 'Attendance notifications', icon: Bell },
    { href: '/admin/weekoff-request', label: 'Swap requests', icon: RefreshCcw },
    { href: '/admin/reports/consolidated', label: 'Consolidated report', icon: BarChart3 },
    { href: '/admin/reports/graphs', label: 'Attendance graphs', icon: BarChart3 },
    { href: '/admin/reports/geotag', label: 'Location audit', icon: MapPin },
    { href: '/admin/leaves', label: 'Leave requests', icon: Palmtree },
    { href: '/admin/oversight', label: 'Attendance oversight', icon: ShieldCheck },
    { href: '/admin/payroll', label: 'Payroll', icon: CreditCard },
    { href: '/admin/roaster', label: 'Shift calendar', icon: Calendar },
];

const primaryLinks = links.slice(0, 4);

function isCurrentPath(pathname: string, href: string) {
    return pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`));
}

export default function AdminNav({ canManageEmployees }: { canManageEmployees: boolean }) {
    const visibleLinks = links.filter(link => !link.adminOnly || canManageEmployees);
    const secondaryLinks = visibleLinks.slice(4);
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const moreIsActive = secondaryLinks.some(link => isCurrentPath(pathname, link.href));

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (isMenuOpen && !dialog.open) dialog.showModal();
        if (!isMenuOpen && dialog.open) dialog.close();
        if (!isMenuOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // A sheet opened on mobile must not trap focus after resizing to desktop.
        const desktop = window.matchMedia('(min-width: 1024px)');
        const closeOnDesktop = () => { if (desktop.matches) setIsMenuOpen(false); };
        desktop.addEventListener('change', closeOnDesktop);
        return () => {
            document.body.style.overflow = previousOverflow;
            desktop.removeEventListener('change', closeOnDesktop);
        };
    }, [isMenuOpen]);

    return (
        <>
            <aside className="admin-sidebar">
                <Link href="/admin" className="admin-brand" aria-label={`${WORKSPACE_NAME} — admin home`}>
                    <AppBrand subtitle="Administration" />
                </Link>

                <nav aria-label="Admin navigation" className="admin-sidebar-links">
                    <p className="admin-nav-label">Workspace</p>
                    {visibleLinks.map((link, index) => {
                        const Icon = link.icon;
                        const active = isCurrentPath(pathname, link.href);
                        return (
                            <div key={link.href}>
                                {index === 4 && <p className="admin-nav-label admin-nav-label-separated">Management & reports</p>}
                                <Link href={link.href} aria-current={active ? 'page' : undefined}
                                    className={`admin-nav-link ${active ? 'admin-nav-link-active' : ''}`}>
                                    <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                                    {link.label}
                                </Link>
                            </div>
                        );
                    })}
                </nav>

                <div className="admin-sidebar-footer">
                    <p className="admin-nav-label">Store workspace</p>
                    <div className="mb-3"><ThemeToggle /></div>
                    <form action="/signout" method="post">
                        <button type="submit" className="admin-nav-link w-full">
                            <LogOut size={18} strokeWidth={1.5} aria-hidden="true" /> Sign out
                        </button>
                    </form>
                </div>
            </aside>

            <nav aria-label="Mobile admin navigation" className="admin-mobile-nav">
                {primaryLinks.map(link => {
                    const Icon = link.icon;
                    const active = isCurrentPath(pathname, link.href);
                    return (
                        <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}
                            className={`admin-mobile-link ${active ? 'admin-mobile-link-active' : ''}`}>
                            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                            <span>{link.mobileLabel}</span>
                        </Link>
                    );
                })}
                <button type="button" onClick={() => setIsMenuOpen(true)}
                    aria-haspopup="dialog" aria-expanded={isMenuOpen} aria-controls="admin-more-navigation"
                    className={`admin-mobile-link ${moreIsActive ? 'admin-mobile-link-active' : ''}`}>
                    <MoreHorizontal size={20} strokeWidth={1.5} aria-hidden="true" />
                    <span>More</span>
                </button>
            </nav>

            <dialog ref={dialogRef} id="admin-more-navigation" aria-labelledby="admin-more-title"
                className="admin-nav-dialog" onCancel={() => setIsMenuOpen(false)} onClose={() => setIsMenuOpen(false)}
                onKeyDown={event => {
                    if (event.key !== 'Tab') return;
                    const controls = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
                    const first = controls[0];
                    const last = controls[controls.length - 1];
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                }}
                onClick={event => { if (event.target === event.currentTarget) setIsMenuOpen(false); }}>
                <div className="admin-nav-sheet">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div>
                            <h2 id="admin-more-title" className="text-lg font-medium">Management & reports</h2>
                            <p className="admin-sheet-description">{WORKSPACE_NAME}</p>
                        </div>
                        <button type="button" onClick={() => setIsMenuOpen(false)} aria-label="Close navigation" className="admin-icon-button">
                            <X size={20} strokeWidth={1.5} aria-hidden="true" />
                        </button>
                    </div>
                    <nav aria-label="More admin navigation" className="grid gap-1">
                        {secondaryLinks.map(link => {
                            const Icon = link.icon;
                            const active = isCurrentPath(pathname, link.href);
                            return (
                                <Link key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)}
                                    aria-current={active ? 'page' : undefined}
                                    className={`admin-nav-link ${active ? 'admin-nav-link-active' : ''}`}>
                                    <Icon size={18} strokeWidth={1.5} aria-hidden="true" /> {link.label}
                                </Link>
                            );
                        })}
                    </nav>
                    <div className="admin-sheet-footer">
                        <ThemeToggle />
                    </div>
                    <form action="/signout" method="post" className="mt-3">
                        <button type="submit" className="admin-nav-link w-full">
                            <LogOut size={18} strokeWidth={1.5} aria-hidden="true" /> Sign out
                        </button>
                    </form>
                </div>
            </dialog>
        </>
    );
}
