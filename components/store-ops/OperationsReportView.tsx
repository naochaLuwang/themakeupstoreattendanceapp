'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { downloadCsv, type ExportCell } from '@/lib/store-ops/export';
import { metricLabels, type OperationsReport } from '@/lib/store-ops/report-model';
const Charts=dynamic(()=>import('./ReportCharts'),{ssr:false,loading:()=> <p role="status" className="py-12 text-sm">Loading charts…</p>});

export default function OperationsReportView({report,from,to,period,date,store,stores}:{report:OperationsReport;from:string;to:string;period:string;date:string;store:string;stores:{id:string;name:string|null}[]}) {
    const [exporting,setExporting]=useState(false);const [error,setError]=useState<string|null>(null);
    const metrics=Object.entries(report.metrics) as [keyof OperationsReport['metrics'],number][];
    const tables:{title:string;headers:string[];rows:ExportCell[][]}[]=[
        {title:'Summary',headers:['Metric','Value'],rows:metrics.map(([key,value])=>[metricLabels[key],value])},
        {title:'Daily activity',headers:['Date','Inspections','Tasks completed','Incidents','Approved damage value'],rows:report.daily.map(row=>[row.date,row.inspections,row.tasks,row.incidents,row.damage_value])},
        {title:'Employee performance',headers:['Employee','Reports','Tasks completed','Checklist items'],rows:report.employees.map(row=>[row.name,row.reports,row.tasks,row.checklist_items])},
        {title:'Incident trends',headers:['Type','Count'],rows:report.incident_types.map(row=>[row.type.replaceAll('_',' '),row.count])},
        {title:'Approved damage returns',headers:['Barcode','Product','Quantity','MRP','Value'],rows:report.damage_returns.map(row=>[row.barcode,row.product,row.quantity,row.mrp,row.value])},
        {title:'Tester usage',headers:['Product','Remaining %','Used (percentage points)','Expiry','Needs replacement'],rows:report.tester_usage.map(row=>[row.product,row.remaining,row.used,row.expiry,row.needs_replacement])},
    ];
    async function pdf() {
        setExporting(true);setError(null);
        try {const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);const doc=new jsPDF();doc.setFontSize(16);doc.text('THE MAKEUP STORE - Store Operations',14,18);doc.setFontSize(10);doc.text(`${from} to ${to} (Asia/Kolkata)`,14,26);
            tables.forEach((table,index)=>{if(index)doc.addPage();doc.text(table.title,14,index?18:36);autoTable(doc,{startY:index?24:42,head:[table.headers],body:table.rows.map(row=>row.map(cell=>cell==null?'':String(cell).replaceAll('₹','INR'))),styles:{fontSize:8}});});doc.save(`store-operations-${from}-${to}.pdf`);
        }catch{setError('PDF export failed. Please retry.');}finally{setExporting(false);}
    }
    return <div className="space-y-6"><div><h1 className="text-2xl font-medium">Operations reports</h1><p className="mt-2 text-sm text-slate-500">{from} – {to} · Asia/Kolkata</p></div>
        <form method="get" className="grid gap-3 rounded-xl border p-4 sm:grid-cols-4"><label className="text-sm">Period<select name="period" defaultValue={period} className="mt-1 w-full rounded border bg-transparent p-2"><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label><label className="text-sm">Date<input type="date" name="date" defaultValue={date} required className="mt-1 w-full rounded border bg-transparent p-2"/></label><label className="text-sm">Store<select name="store" defaultValue={store} className="mt-1 w-full rounded border bg-transparent p-2"><option value="">All authorized stores</option>{stores.map(item=><option key={item.id} value={item.id}>{item.name||'Store'}</option>)}</select></label><button className="self-end rounded-lg border px-4 py-2 text-sm">Apply filters</button></form>
        <div className="flex flex-wrap gap-3"><button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={()=>downloadCsv(`store-operations-${from}-${to}.csv`,['Section','Field 1','Field 2','Field 3','Field 4','Field 5'],tables.flatMap(table=>[[table.title,...table.headers],...table.rows.map(row=>[table.title,...row])]))}>Export CSV</button><button type="button" disabled={exporting} onClick={()=>void pdf()} className="rounded-lg border px-4 py-2 text-sm">{exporting?'Creating PDF…':'Export PDF'}</button></div>{error&&<p role="alert" className="text-sm text-rose-600">{error}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{metrics.map(([key,value])=><div key={key} className="rounded-xl border p-4"><p className="text-xs text-slate-500">{metricLabels[key]}</p><p className="mt-2 text-2xl font-medium">{value.toLocaleString('en-IN',{maximumFractionDigits:1})}</p></div>)}</div>
        <Charts report={report}/>
        {tables.slice(1).map(table=><section key={table.title} className="min-w-0 space-y-3"><h2 className="text-lg font-medium">{table.title}</h2>{table.rows.length?<div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead><tr>{table.headers.map(header=><th key={header} scope="col" className="whitespace-nowrap border-b p-3 font-medium">{header}</th>)}</tr></thead><tbody>{table.rows.map((row,index)=><tr key={index}>{row.map((cell,column)=><td key={column} className="whitespace-nowrap border-b p-3">{typeof cell==='boolean'?(cell?'Yes':'No'):cell??'—'}</td>)}</tr>)}</tbody></table></div>:<p className="rounded-xl border p-5 text-sm text-slate-500">No records in this period.</p>}</section>)}
        <p className="text-xs text-slate-500">Damage value includes approved reports. Task completion measures tasks created in this period. Inspection coverage counts section-days inspected. Tester usage counts decreases in recorded remaining percentages. Missing legacy store assignments and timestamps need administrator reconciliation.</p>
    </div>;
}
