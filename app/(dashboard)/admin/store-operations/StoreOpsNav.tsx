'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, AlertTriangle, FlaskConical,
  CheckSquare, ListTodo, Store, FileWarning, PackageSearch,
  FileText, Settings
} from 'lucide-react'

interface StoreOpsNavProps {
  role: string
}

const modules = [
  { href: '/admin/store-operations', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/store-operations/shelf-inspection', label: 'Shelf inspection', icon: ClipboardList },
  { href: '/admin/store-operations/damage-reports', label: 'Damage reports', icon: AlertTriangle },
  { href: '/admin/store-operations/testers', label: 'Testers', icon: FlaskConical },
  { href: '/admin/store-operations/daily-checklist', label: 'Daily checklist', icon: CheckSquare },
  { href: '/admin/store-operations/tasks', label: 'Tasks', icon: ListTodo },
  { href: '/admin/store-operations/audits', label: 'Store audits', icon: Store },
  { href: '/admin/store-operations/incidents', label: 'Incidents', icon: FileWarning },
  { href: '/admin/store-operations/restocking', label: 'Restocking', icon: PackageSearch },
  { href: '/admin/store-operations/notifications', label: 'Notifications', icon: ClipboardList },
  { href: '/admin/store-operations/reports', label: 'Reports', icon: FileText },
  { href: '/admin/store-operations/settings', label: 'Settings', icon: Settings },
]

export default function StoreOpsNav({ role }: StoreOpsNavProps) {
  const pathname = usePathname()

  return (
    <nav aria-label="Store operations" data-role={role} className="admin-ops-nav">
      {modules.map(mod => {
        const isActive = pathname === mod.href || (mod.href !== '/admin/store-operations' && pathname.startsWith(mod.href + '/'))
        return (
          <Link
            key={mod.href}
            href={mod.href}
            aria-current={isActive ? 'page' : undefined}
            className="admin-ops-link"
          >
            <mod.icon size={16} strokeWidth={1.5} aria-hidden="true" />
            {mod.label}
          </Link>
        )
      })}
    </nav>
  )
}
