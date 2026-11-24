'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';
import { ClipboardList, AlertTriangle, FlaskConical, CheckSquare, ListTodo, FileWarning, PackageSearch, Grid2X2, ChevronDown } from 'lucide-react';

const modules = [
    { path: 'shelf-inspection', label: 'Shelf inspection', icon: ClipboardList },
    { path: 'damage-reports', label: 'Damage reports', icon: AlertTriangle },
    { path: 'testers', label: 'Testers', icon: FlaskConical },
    { path: 'daily-checklist', label: 'Daily checklist', icon: CheckSquare },
    { path: 'tasks', label: 'Tasks', icon: ListTodo },
    { path: 'incidents', label: 'Incidents', icon: FileWarning },
    { path: 'restocking', label: 'Restocking', icon: PackageSearch },
];

export default function EmployeeStoreOpsNav({ variant = 'tabs' }: { variant?: 'tabs' | 'home' }) {
    const pathname = usePathname();
    const [expanded, setExpanded] = useState(false);
    const moreId = useId();
    if (variant === 'home') {
        const shortcuts = [
            { path: 'tasks', label: 'My tasks', icon: ListTodo },
            { path: 'daily-checklist', label: 'Daily checklist', icon: CheckSquare },
            { path: 'incidents/new', label: 'Report an issue', icon: FileWarning },
        ];
        return <nav className="employee-home-operations" aria-label="Quick actions">
            <div className="employee-quick-actions">
                {shortcuts.map(({ path, label, icon: Icon }) => <Link key={path} href={`/employee/store-operations/${path}`}><Icon size={20} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span></Link>)}
                <button type="button" aria-expanded={expanded} aria-controls={moreId} onClick={() => setExpanded(value => !value)}><Grid2X2 size={20} strokeWidth={1.6} aria-hidden="true" /><span>More operations</span><ChevronDown size={14} className={expanded ? 'employee-chevron-open' : ''} aria-hidden="true" /></button>
            </div>
            <div id={moreId} hidden={!expanded} className="employee-more-operations">
                {modules.filter(module => !['tasks', 'daily-checklist'].includes(module.path)).map(({ path, label, icon: Icon }) => <Link key={path} href={`/employee/store-operations/${path}`}><Icon size={18} aria-hidden="true" />{label}</Link>)}
            </div>
        </nav>;
    }
    return (
        <nav aria-label="Employee store operations" className="employee-ops-nav">
            {modules.map(module => {
                const href = `/employee/store-operations/${module.path}`;
                const Icon = module.icon;
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                    <Link key={module.path} href={href} aria-current={active ? 'page' : undefined} className="employee-ops-link">
                        <Icon size={16} aria-hidden="true" />{module.label}
                    </Link>
                );
            })}
        </nav>
    );
}
