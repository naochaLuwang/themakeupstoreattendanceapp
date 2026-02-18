'use client';
import { useState } from 'react';
import { processPayroll } from './actions';
import { IndianRupee, Zap, Calculator } from 'lucide-react';

export default function PayrollTable({ initialData, history }: { initialData: any[], history: any[] }) {
    const [adjustments, setAdjustments] = useState<Record<string, any>>(
        Object.fromEntries(initialData.map(d => [d.employee_id, { overtime: 0, bonus: 0, deduct: 0 }]))
    );

    const updateAdjust = (id: string, field: string, val: string) => {
        setAdjustments(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: parseFloat(val) || 0 }
        }));
    };

    const handleAutoOT = (id: string, hrs: number, rate: number) => {
        if (hrs > 160) {
            const otPay = (hrs - 160) * (rate * 1.5);
            updateAdjust(id, 'overtime', otPay.toFixed(2));
        }
    };

    return (
        <div className="bg-white border border-slate-100 rounded-[3rem] shadow-2xl overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                    <tr>
                        <th className="px-8 py-6">Employee / Status</th>
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
                        const totalMonthlyEarnings = (row.total_hours || 0) * rate;

                        // Calculate already paid (Advances/Partial Salary)
                        const alreadyPaid = history
                            .filter(h => h.employee_id === id &&
                                new Date(h.month_year).getMonth() === new Date().getMonth())
                            .reduce((sum, rec) => sum + rec.net_pay, 0);

                        const balanceDue = totalMonthlyEarnings - alreadyPaid;
                        const adj = adjustments[id] || { overtime: 0, bonus: 0, deduct: 0 };
                        const finalNet = balanceDue + adj.overtime + adj.bonus - adj.deduct;

                        return (
                            <tr key={id} className="hover:bg-slate-50/30 transition-all group">
                                <td className="px-8 py-6">
                                    <p className="font-black text-slate-900 leading-none">{row.full_name}</p>
                                    <div className="flex flex-col gap-1 mt-2">
                                        <p className="text-[10px] font-bold text-slate-400 italic">Total: ₹{totalMonthlyEarnings.toLocaleString('en-IN')}</p>
                                        <p className="text-[10px] font-black text-emerald-500 uppercase">Paid: ₹{alreadyPaid.toLocaleString('en-IN')}</p>
                                    </div>
                                </td>
                                <td className="px-4 py-6">
                                    <div className="flex flex-col items-center gap-1">
                                        <input type="number" value={adj.overtime || ''} placeholder="0" className="w-20 bg-orange-50 p-2 rounded-xl text-center text-xs font-black" onChange={(e) => updateAdjust(id, 'overtime', e.target.value)} />
                                        <button onClick={() => handleAutoOT(id, row.total_hours, rate)} className="text-[7px] font-black text-orange-500 uppercase">Auto OT</button>
                                    </div>
                                </td>
                                <td className="px-4 py-6">
                                    <input type="number" placeholder="0" className="w-20 bg-emerald-50 p-2 rounded-xl text-center text-xs font-black" onChange={(e) => updateAdjust(id, 'bonus', e.target.value)} />
                                </td>
                                <td className="px-4 py-6">
                                    <input type="number" placeholder="0" className="w-20 bg-rose-50 p-2 rounded-xl text-center text-xs font-black" onChange={(e) => updateAdjust(id, 'deduct', e.target.value)} />
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="text-xl font-black italic">₹{finalNet.toLocaleString('en-IN')}</span>
                                        <form action={processPayroll}>
                                            <input type="hidden" name="employeeId" value={id} />
                                            <input type="hidden" name="baseHours" value={row.total_hours} />
                                            <input type="hidden" name="grossPay" value={balanceDue} />
                                            <input type="hidden" name="overtime" value={adj.overtime} />
                                            <input type="hidden" name="bonus" value={adj.bonus} />
                                            <input type="hidden" name="deductions" value={adj.deduct} />
                                            <input type="hidden" name="netPay" value={finalNet} />
                                            <input type="hidden" name="type" value="salary" />
                                            <button className="bg-slate-900 text-white text-[9px] font-black uppercase px-4 py-2 rounded-lg hover:bg-indigo-600 shadow-lg shadow-slate-100">Settle</button>
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