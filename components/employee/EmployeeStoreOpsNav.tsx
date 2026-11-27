'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Grid2X2, X } from 'lucide-react';
import { activeEmployeeOperation, employeeOperationsModules, employeeOperationsRoot } from '@/lib/store-ops/employee-navigation';
import EmployeeOperationIcon from './EmployeeOperationIcon';

export default function EmployeeStoreOpsNav({ variant = 'workspace' }: { variant?: 'workspace' | 'home' }) {
    const pathname = usePathname();
    const [expanded, setExpanded] = useState(false);
    const [openedOn, setOpenedOn] = useState<string | null>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const id = useId();
    const current = activeEmployeeOperation(pathname);
    const open = openedOn === pathname;

    useEffect(() => {
        if (variant === 'home' || !open) { dialog.current?.close(); return; }
        const picker = dialog.current;
        if (!picker) return;
        picker.showModal();
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const desktop = window.matchMedia('(min-width: 1024px)');
        const closeOnDesktop = () => { if (desktop.matches) setOpenedOn(null); };
        desktop.addEventListener('change', closeOnDesktop);
        return () => {
            picker.close();
            document.body.style.overflow = previousOverflow;
            desktop.removeEventListener('change', closeOnDesktop);
        };
    }, [open, variant]);

    if (variant === 'home') {
        const shortcuts = [
            { path: 'tasks', label: 'My tasks', icon: 'tasks' },
            { path: 'daily-checklist', label: 'Daily checklist', icon: 'daily-checklist' },
            { path: 'incidents/new', label: 'Report an issue', icon: 'incidents' },
        ] as const;
        return <nav className="employee-home-operations" aria-label="Quick actions">
            <div className="employee-quick-actions">
                {shortcuts.map(({ path, label, icon }) => <Link key={path} href={`${employeeOperationsRoot}/${path}`}><EmployeeOperationIcon name={icon} /><span>{label}</span></Link>)}
                <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}><Grid2X2 size={20} strokeWidth={1.6} aria-hidden="true" /><span>More operations</span><ChevronDown size={14} className={expanded ? 'employee-chevron-open' : ''} aria-hidden="true" /></button>
            </div>
            <div id={id} hidden={!expanded} className="employee-more-operations">
                <Link href={employeeOperationsRoot}><EmployeeOperationIcon name="overview" size={18} />All operations</Link>
                {employeeOperationsModules.filter(module => !['tasks', 'daily-checklist'].includes(module.path)).map(module => <Link key={module.path} href={`${employeeOperationsRoot}/${module.path}`}><EmployeeOperationIcon name={module.path} size={18} />{module.label}</Link>)}
            </div>
        </nav>;
    }

    const links = <>
        <Link href={employeeOperationsRoot} aria-current={pathname === employeeOperationsRoot ? 'page' : undefined} onClick={() => setOpenedOn(null)} className="ops-navigation-link"><EmployeeOperationIcon name="overview" /><span>Overview</span></Link>
        {employeeOperationsModules.map(module => <Link key={module.path} href={`${employeeOperationsRoot}/${module.path}`} aria-current={current?.path === module.path ? 'page' : undefined} onClick={() => setOpenedOn(null)} className="ops-navigation-link"><EmployeeOperationIcon name={module.path} /><span>{module.label}</span></Link>)}
    </>;

    return <aside className="ops-navigation">
        <div className="ops-mobile-navigation">
            <Link className="ops-workspace-label" href={employeeOperationsRoot}>Store operations</Link>
            <button ref={trigger} type="button" className="ops-module-trigger" aria-label={`Switch module, current: ${current?.label || 'Overview'}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-picker`} onClick={() => setOpenedOn(pathname)}>
                <span className="ops-trigger-icon"><EmployeeOperationIcon name={current?.path || 'overview'} /></span><span>{current?.label || 'Overview'}</span><ChevronDown size={18} aria-hidden="true" />
            </button>
        </div>
        <div className="ops-desktop-navigation"><Link className="ops-workspace-label" href={employeeOperationsRoot}>Store operations</Link><nav aria-label="Employee store operations">{links}</nav></div>
        <dialog ref={dialog} id={`${id}-picker`} className="ops-module-picker" aria-labelledby={`${id}-title`} onClose={() => { setOpenedOn(null); trigger.current?.focus(); }} onCancel={() => setOpenedOn(null)} onClick={event => { if (event.target === event.currentTarget) setOpenedOn(null); }}>
            <div className="ops-picker-panel">
                <div className="ops-picker-heading"><h2 id={`${id}-title`}>Store operations</h2><button type="button" aria-label="Close modules" onClick={() => setOpenedOn(null)}><X size={20} aria-hidden="true" /></button></div>
                <nav aria-label="Choose a store operations module">{links}</nav>
            </div>
        </dialog>
    </aside>;
}
