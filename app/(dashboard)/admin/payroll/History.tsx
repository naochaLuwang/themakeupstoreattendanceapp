'use client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, History as HistoryIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function PayrollHistory({ history }: { history: any[] }) {
    // State to handle hydration
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const downloadPDF = (rec: any) => {
        const doc = new jsPDF();
        const dateStr = new Date(rec.month_year).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

        doc.setFontSize(22);
        doc.text("PAYSLIP", 105, 20, { align: "center" });

        autoTable(doc, {
            startY: 35,
            head: [['Description', 'Amount']],
            body: [
                ['Employee', rec.profiles?.full_name],
                ['Month', dateStr],
                ['Type', rec.type?.toUpperCase() || 'SALARY'],
                ['Base Hours', `${rec.base_hours} hrs`],
                ['Overtime Pay', `INR ${rec.overtime_pay}`],
                ['Bonus', `INR ${rec.bonus_pay}`],
                ['Deductions', `INR ${rec.deductions}`],
                ['NET SETTLEMENT', `INR ${rec.net_pay}`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [0, 0, 0] },
        });

        doc.save(`Payslip_${rec.profiles?.full_name}_${dateStr}.pdf`);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-black italic flex items-center gap-3">
                <HistoryIcon /> Transaction History
            </h2>
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                        <tr>
                            <th className="px-8 py-4">Date</th>
                            <th className="px-6 py-4">Personnel</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4 text-center">Amount (₹)</th>
                            <th className="px-8 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {history.map((rec) => (
                            <tr key={rec.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-4 font-bold text-slate-500">
                                    {/* Only render date on client to avoid mismatch */}
                                    {mounted ? new Date(rec.created_at).toLocaleDateString('en-IN') : '---'}
                                </td>
                                <td className="px-6 py-4 font-black">{rec.profiles?.full_name}</td>
                                <td className="px-6 py-4 italic text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {rec.type}
                                </td>
                                <td className="px-6 py-4 text-center font-black text-slate-900">
                                    ₹{rec.net_pay.toLocaleString('en-IN')}
                                </td>
                                <td className="px-8 py-4 text-right">
                                    <button
                                        onClick={() => downloadPDF(rec)}
                                        className="p-2 hover:bg-slate-900 hover:text-white rounded-xl transition-all"
                                    >
                                        <FileText size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}