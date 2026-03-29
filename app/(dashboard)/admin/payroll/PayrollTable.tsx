'use client';
import { useState } from 'react';
import { processPayroll } from './actions';
import { IndianRupee, Zap, Calculator } from 'lucide-react';

export default function PayrollTable({ initialData, history }: { initialData: any[], history: any[] }) {
    const [adjustments, setAdjustments] = useState<Record<string, any>>(
        Object.fromEntries(initialData.map(d => [d.employee_id, { overtime: 0, bonus: 0, deduct: 0, overrideBase: null }]))
    );

    const updateAdjust = (id: string, field: string, val: string) => {
        setAdjustments(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: val === '' && field === 'overrideBase' ? null : (parseFloat(val) || 0) }
        }));
    };

    const handleAutoOT = (id: string, otHours: number, rate: number) => {
        if (otHours > 0) {
            const otPay = Math.round(otHours * (rate * 1.5));
            updateAdjust(id, 'overtime', String(otPay));
        }
    };

    return (
        <div className="bg-white border border-slate-100 rounded-[3rem] shadow-2xl overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                    <tr>
                        <th className="px-8 py-6">Personnel / Details</th>
                        <th className="px-4 py-6 text-center">Gross Pay (₹)</th>
                        <th className="px-4 py-6 text-center">OT (₹)</th>
                        <th className="px-4 py-6 text-center">Bonus (₹)</th>
                        <th className="px-4 py-6 text-center">Deduct (₹)</th>
                        <th className="px-8 py-6 text-right text-indigo-600">Balance Due</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {initialData.map((row) => {
                        const id = row.employee_id;
                        const rate = row.profile?.hourly_rate || 0;
                        const totalHours = row.total_hours || 0;
                        const defaultTotalEarnings = Math.round(totalHours * rate);

                        const adj = adjustments[id] || { overtime: 0, bonus: 0, deduct: 0, overrideBase: null };
                        const activeBaseEarnings = adj.overrideBase !== null ? (parseFloat(adj.overrideBase) || 0) : defaultTotalEarnings;

                        // Calculate already paid (Advances/Partial Salary)
                        const currentMonthNum = new Date().getMonth();
                        const alreadyPaid = Array.isArray(history) 
                            ? history
                                .filter(h => h.employee_id === id && new Date(h.month_year).getMonth() === currentMonthNum)
                                .reduce((sum, rec) => sum + rec.net_pay, 0)
                            : 0;

                        // Ensure balance due cannot drop strictly below 0 structurally if advance is higher
                        const balanceDue = Math.max(0, activeBaseEarnings - alreadyPaid);
                        
                        // Final settlement is base due + bonuses - deductions
                        const finalNet = Math.round(balanceDue + (adj.overtime || 0) + (adj.bonus || 0) - (adj.deduct || 0));

                        return (
                            <tr key={id} className="hover:bg-slate-50/30 transition-all group">
                                <td className="px-8 py-6">
                                    <p className="font-black text-slate-900 leading-none">{row.full_name}</p>
                                    <div className="flex flex-col gap-1 mt-2">
                                        <p className="text-[10px] font-bold text-slate-400 italic">Expected: {totalHours} hrs × ₹{rate}/hr = ₹{defaultTotalEarnings.toLocaleString('en-IN')}</p>
                                        <p className="text-[10px] font-black text-emerald-500 uppercase flex items-center gap-1">
                                            {alreadyPaid > 0 ? `Paid Advance: ₹${alreadyPaid.toLocaleString('en-IN')}` : 'No Advance Drawn'}
                                        </p>
                                    </div>
                                </td>
                                <td className="px-4 py-6">
                                    <div className="flex flex-col items-center gap-1">
                                        <input type="number" 
                                            value={adj.overrideBase !== null ? adj.overrideBase : defaultTotalEarnings} 
                                            placeholder="Base" 
                                            className="w-24 bg-indigo-50/50 p-2 rounded-xl text-center text-xs font-black outline-none focus:bg-indigo-100" 
                                            onChange={(e) => updateAdjust(id, 'overrideBase', e.target.value)} 
                                        />
                                        <span className="text-[7px] font-black text-indigo-400 uppercase">Review Gross</span>
                                    </div>
                                </td>
                                <td className="px-4 py-6">
                                    <div className="flex flex-col items-center gap-1">
                                        <input type="number" value={adj.overtime || ''} placeholder="0" className="w-20 bg-orange-50 p-2 rounded-xl text-center text-xs font-black outline-none focus:bg-orange-100" onChange={(e) => updateAdjust(id, 'overtime', e.target.value)} />
                                        <button type="button" onClick={() => handleAutoOT(id, row.total_ot || 0, rate)} className="text-[7px] font-black text-orange-500 uppercase active:scale-95 transition-all outline-none">Auto OT ({row.total_ot || 0}h)</button>
                                    </div>
                                </td>
                                <td className="px-4 py-6">
                                    <input type="number" value={adj.bonus || ''} placeholder="0" className="w-20 bg-emerald-50 p-2 rounded-xl text-center text-xs font-black outline-none focus:bg-emerald-100" onChange={(e) => updateAdjust(id, 'bonus', e.target.value)} />
                                </td>
                                <td className="px-4 py-6">
                                    <input type="number" value={adj.deduct || ''} placeholder="0" className="w-20 bg-rose-50 p-2 rounded-xl text-center text-xs font-black outline-none focus:bg-rose-100" onChange={(e) => updateAdjust(id, 'deduct', e.target.value)} />
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex flex-col items-end gap-2">
                                        <span className={`text-xl font-black italic ${finalNet < 0 ? 'text-rose-500' : 'text-slate-900'}`}>
                                            ₹{finalNet.toLocaleString('en-IN')}
                                        </span>
                                        <form action={processPayroll}>
                                            <input type="hidden" name="employeeId" value={id} />
                                            <input type="hidden" name="baseHours" value={totalHours} />
                                            <input type="hidden" name="grossPay" value={activeBaseEarnings} />
                                            <input type="hidden" name="overtime" value={adj.overtime} />
                                            <input type="hidden" name="bonus" value={adj.bonus} />
                                            <input type="hidden" name="deductions" value={adj.deduct} />
                                            <input type="hidden" name="netPay" value={finalNet} />
                                            <input type="hidden" name="type" value="salary" />
                                            
                                            <button 
                                                disabled={finalNet <= 0 && balanceDue <= 0 && adj.bonus === 0} 
                                                className="bg-slate-900 text-white text-[9px] font-black uppercase px-4 py-2 rounded-lg hover:bg-indigo-600 active:scale-95 transition-all shadow-lg shadow-slate-200 disabled:bg-slate-100 disabled:text-slate-300 disabled:shadow-none"
                                            >
                                                Settle Earnings
                                            </button>
                                        </form>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}