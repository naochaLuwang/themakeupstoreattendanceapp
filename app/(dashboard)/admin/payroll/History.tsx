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
        const generateFailsafeOrSuccess = (imgElement: HTMLImageElement | null) => {
            const doc = new jsPDF();
            const dateStr = new Date(rec.month_year).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

            if (imgElement) {
                doc.addImage(imgElement, 'PNG', 95, 15, 20, 20); // Center standard 20x20
            }

            doc.setFontSize(22);
            doc.setFont("times", "bold");
            doc.text("THE MAKEUP STORE", 105, imgElement ? 45 : 25, { align: "center" });

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100);
            doc.text("Official Payslip & Settlement Record", 105, imgElement ? 51 : 31, { align: "center" });

            // Settlement Tracker
            const thisMonthHistory = history.filter(h => h.employee_id === rec.employee_id && new Date(h.month_year).getMonth() === new Date(rec.month_year).getMonth());
            const totalPaidThisMonth = thisMonthHistory.reduce((sum, h) => sum + h.net_pay, 0);

            // Values
            const grossPay = Math.round(rec.gross_pay || 0);
            const netPay = Math.round(rec.net_pay || 0);
            const settlementLeft = Math.max(0, grossPay - totalPaidThisMonth);

            autoTable(doc, {
                startY: imgElement ? 65 : 45,
                margin: { left: 30, right: 30 }, // Constrict width heavily to center the table structurally
                head: [['Description', 'Amount (INR)']],
                body: [
                    ['Employee Name', rec.profiles?.full_name || 'N/A'],
                    ['Pay Period', dateStr],
                    ['Settlement Type', rec.type?.toUpperCase() || 'SALARY'],
                    ['Gross Base Earnings', grossPay.toLocaleString('en-IN')],
                    ['Overtime Compensation', Math.round(rec.overtime_pay).toLocaleString('en-IN')],
                    ['Bonus Allocation', Math.round(rec.bonus_pay).toLocaleString('en-IN')],
                    ['Deductions', `- ${Math.round(rec.deductions).toLocaleString('en-IN')}`],
                    ['NET SETTLEMENT', netPay.toLocaleString('en-IN')],
                    ['OUTSTANDING BALANCE', settlementLeft > 0 ? settlementLeft.toLocaleString('en-IN') : 'FULLY SETTLED'],
                ],
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42] },
                styles: { fontSize: 10, cellPadding: 8 },
                columnStyles: {
                    0: { fontStyle: 'bold', textColor: [30, 41, 59] },
                    1: { halign: 'right', textColor: [71, 85, 105], fontStyle: 'bold' }
                },
                didParseCell: function (data) {
                    if (data.row.index === 7 || data.row.index === 8) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.textColor = [15, 23, 42];
                    }
                }
            });

            // Footer Security Clause
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("This is a computer-generated document. No signature is required.", 105, 280, { align: "center" });

            doc.save(`Payslip_${(rec.profiles?.full_name || '').replace(/ /g, '_')}_${dateStr.replace(/ /g, '_')}.pdf`);
        };

        // Try dynamically loading the store icon from public folder
        const img = new Image();
        img.src = '/icon-512x512.png';
        img.onload = () => generateFailsafeOrSuccess(img);
        img.onerror = () => generateFailsafeOrSuccess(null);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-medium flex items-center gap-3">
                <HistoryIcon /> Transaction history
            </h2>
            <div className="bg-white rounded-xl border border-slate-100 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-slate-50 text-sm font-medium text-slate-500">
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
                                <td className="px-8 py-4 font-medium text-slate-500">
                                    {/* Only render date on client to avoid mismatch */}
                                    {mounted ? new Date(rec.created_at).toLocaleDateString('en-IN') : '---'}
                                </td>
                                <td className="px-6 py-4 font-medium">{rec.profiles?.full_name}</td>
                                <td className="px-6 py-4 text-sm font-medium tracking-normal text-slate-500">
                                    {rec.type}
                                </td>
                                <td className="px-6 py-4 text-center font-medium text-slate-900">
                                    ₹{rec.net_pay.toLocaleString('en-IN')}
                                </td>
                                <td className="px-8 py-4 text-right">
                                    <button
                                        aria-label={`Download payslip for ${rec.profiles?.full_name || "staff member"}`} onClick={() => downloadPDF(rec)}
                                        className="p-2 hover:bg-slate-900 hover:text-white rounded-xl transition-colors"
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
