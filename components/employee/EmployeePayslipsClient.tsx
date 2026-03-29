'use client';
import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileDown, CalendarDays } from 'lucide-react';

export default function EmployeePayslipsClient({ history }: { history: any[] }) {
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
            doc.text("THE MAKEUP STORE WANGKHEI", 105, imgElement ? 45 : 25, { align: "center" });
            
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100);
            doc.text("Official Payslip & Settlement Record", 105, imgElement ? 51 : 31, { align: "center" });

            // Settlement Tracker
            const thisMonthHistory = history.filter(h => h.employee_id === rec.employee_id && new Date(h.month_year).getMonth() === new Date(rec.month_year).getMonth());
            const totalPaidThisMonth = thisMonthHistory.reduce((sum, h) => sum + h.net_pay, 0);

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

        const img = new Image();
        img.src = '/icon-512x512.png';
        img.onload = () => generateFailsafeOrSuccess(img);
        img.onerror = () => generateFailsafeOrSuccess(null);
    };

    if (history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[2rem] border border-black/5 mt-4 text-center">
                <CalendarDays size={32} className="text-black/20 mb-4" />
                <p className="text-sm font-black text-slate-800 tracking-tighter uppercase">No Records Found</p>
                <p className="text-[10px] font-bold text-slate-400 mt-2">Your historical payslips will securely appear here once generated.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 mt-4">
            {history.map((rec) => (
                <div key={rec.id} className="bg-white p-6 rounded-[2rem] border border-black/5 flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-lg font-black text-slate-900 tracking-tighter">
                            {mounted ? new Date(rec.month_year).toLocaleString('en-IN', { month: 'long', year: 'numeric' }) : '---'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[8px] font-black tracking-widest uppercase bg-indigo-50 text-indigo-500 px-2 py-1 rounded-[4px]">
                                {rec.type}
                            </span>
                            <span className="text-xs font-bold text-slate-500">
                                ₹{Math.round(rec.net_pay).toLocaleString('en-IN')}
                            </span>
                        </div>
                    </div>
                    <button 
                        onClick={() => downloadPDF(rec)}
                        className="w-12 h-12 flex items-center justify-center bg-slate-900 text-white rounded-2xl hover:bg-slate-800 active:scale-95 transition-all shadow-md"
                    >
                        <FileDown size={18} />
                    </button>
                </div>
            ))}
        </div>
    );
}
