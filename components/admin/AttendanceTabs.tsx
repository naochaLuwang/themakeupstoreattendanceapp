'use client'

import { useState } from 'react'
import { Search, Pencil } from 'lucide-react'
import AttendanceLogTable from './AttendanceLogTable'
import ManualAttendanceEntry from './ManualAttendanceEntry'

interface Employee { id: string; full_name: string | null; store_id: string | null }

type Tab = 'logs' | 'manual'

export default function AttendanceTabs({ employees }: { employees: Employee[] }) {
    const [activeTab, setActiveTab] = useState<Tab>('logs')

    return (
        <div className="space-y-6">
            <div role="tablist" aria-label="Attendance view" className="flex gap-2" onKeyDown={event => {
                const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
                if (!keys.includes(event.key)) return;
                event.preventDefault();
                const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
                const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                tabs[next]?.focus();
                tabs[next]?.click();
            }}>
                <button type="button" role="tab" id="attendance-logs-tab" tabIndex={activeTab === 'logs' ? 0 : -1} aria-selected={activeTab === 'logs'} aria-controls="attendance-logs-panel" onClick={() => setActiveTab('logs')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium  tracking-normal transition-colors ${
                        activeTab === 'logs'
                            ? 'bg-slate-900 text-white  '
                            : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                    }`}>
                    <Search size={14} /> Logs
                </button>
                <button type="button" role="tab" id="attendance-manual-tab" tabIndex={activeTab === 'manual' ? 0 : -1} aria-selected={activeTab === 'manual'} aria-controls="attendance-manual-panel" onClick={() => setActiveTab('manual')}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium  tracking-normal transition-colors ${
                        activeTab === 'manual'
                            ? 'bg-slate-900 text-white  '
                            : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                    }`}>
                    <Pencil size={16} aria-hidden="true" /> Manual entry
                </button>
            </div>

            {activeTab === 'logs' && <div role="tabpanel" id="attendance-logs-panel" aria-labelledby="attendance-logs-tab"><AttendanceLogTable employees={employees} /></div>}
            {activeTab === 'manual' && <div role="tabpanel" id="attendance-manual-panel" aria-labelledby="attendance-manual-tab"><ManualAttendanceEntry employees={employees} /></div>}
        </div>
    )
}
