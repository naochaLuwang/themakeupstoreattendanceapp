import { AlertTriangle, Bell, CheckSquare, ClipboardList, FileWarning, FlaskConical, Grid2X2, ListTodo, PackageSearch } from 'lucide-react';
import type { EmployeeOperationPath } from '@/lib/store-ops/employee-navigation';

const icons = { tasks: ListTodo, 'daily-checklist': CheckSquare, 'shelf-inspection': ClipboardList, restocking: PackageSearch, testers: FlaskConical, 'damage-reports': AlertTriangle, incidents: FileWarning, notifications: Bell, overview: Grid2X2 };

export default function EmployeeOperationIcon({ name, size = 20 }: { name: EmployeeOperationPath | 'overview'; size?: number }) {
    const Icon = icons[name];
    return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}
