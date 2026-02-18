'use client';
import { processPayroll } from './actions';
import { IndianRupee, Send } from 'lucide-react';

export default function AdvanceForm({ profiles }: { profiles: any[] }) {
    return (
        <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white">
            <p className="text-[10px] font-black uppercase opacity-40 mb-4 tracking-widest">Quick Advance Request</p>
            <form action={processPayroll} className="flex gap-2">
                <select name="employeeId" required className="bg-slate-800 border-none rounded-xl text-[10px] font-bold py-2 focus:ring-1 ring-indigo-500 outline-none flex-1">
                    <option value="">Employee</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                <input type="number" name="netPay" placeholder="Amount" required className="w-24 bg-slate-800 border-none rounded-xl text-[10px] font-bold py-2 px-3 focus:ring-1 ring-indigo-500 outline-none" />
                <input type="hidden" name="type" value="advance" />
                <button className="bg-indigo-600 p-2 rounded-xl hover:bg-indigo-500 transition-colors">
                    <Send size={14} />
                </button>
            </form>
        </div>
    );
}