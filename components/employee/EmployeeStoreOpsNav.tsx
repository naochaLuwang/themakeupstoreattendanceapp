'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, AlertTriangle, FlaskConical, CheckSquare, ListTodo, FileWarning, PackageSearch } from 'lucide-react';

const modules = [
    { path: 'shelf-inspection', label: 'Shelf inspection', icon: ClipboardList },
    { path: 'damage-reports', label: 'Damage reports', icon: AlertTriangle },
    { path: 'testers', label: 'Testers', icon: FlaskConical },
    { path: 'daily-checklist', label: 'Daily checklist', icon: CheckSquare },
    { path: 'tasks', label: 'Tasks', icon: ListTodo },
    { path: 'incidents', label: 'Incidents', icon: FileWarning },
    { path: 'restocking', label: 'Restocking', icon: PackageSearch },
];

export default function EmployeeStoreOpsNav() {
    const pathname = usePathname();
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
