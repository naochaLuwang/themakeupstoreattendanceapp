'use client';
import { processPayroll } from './actions';
import { Send } from 'lucide-react';

export default function AdvanceForm({ profiles }: { profiles: any[] }) {
    return (
        <div className="bg-white border border-slate-200 p-4 rounded-xl">
            <p className="text-sm font-medium text-slate-900 mb-3">Record an advance</p>
            <form action={processPayroll} className="grid grid-cols-[minmax(0,1fr)_96px_40px] gap-2">
                <select aria-label="Employee for advance" name="employeeId" required className="min-w-0 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium px-3 py-2 focus:ring-1 ring-indigo-500 outline-none flex-1">
                    <option value="">Employee</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <input aria-label="Advance amount in rupees" type="number" name="netPay" placeholder="Amount" required className="w-24 min-w-0 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium py-2 px-3 focus:ring-1 ring-indigo-500 outline-none" />
                <input type="hidden" name="type" value="advance" />
                <button aria-label="Record advance" className="bg-slate-900 text-white p-2 rounded-xl hover:bg-indigo-500 transition-colors">
                    <Send size={14} />
                </button>
            </form>
        </div>
    );
}
