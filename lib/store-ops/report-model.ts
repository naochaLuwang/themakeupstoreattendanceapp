import { z } from 'zod';
export const reportSchema = z.object({
    metrics: z.object({ inspections:z.number(),inspection_completion:z.number(),damage_reports:z.number(),damage_value:z.number(),tasks:z.number(),task_completion:z.number(),audit_score:z.number(),checklist_compliance:z.number(),incidents:z.number(),tester_usage:z.number() }),
    daily:z.array(z.object({date:z.string(),inspections:z.number(),tasks:z.number(),incidents:z.number(),damage_value:z.number()})),
    employees:z.array(z.object({id:z.string(),name:z.string(),reports:z.number(),tasks:z.number(),checklist_items:z.number()})),
    incident_types:z.array(z.object({type:z.string(),count:z.number()})),
    damage_returns:z.array(z.object({barcode:z.string(),product:z.string(),quantity:z.number(),mrp:z.number(),value:z.number()})),
    tester_usage:z.array(z.object({id:z.string(),product:z.string(),remaining:z.number(),needs_replacement:z.boolean(),expiry:z.string().nullable(),used:z.number()})),
    audit_history:z.array(z.object({id:z.string(),date:z.string(),score:z.number()})),
});
export type OperationsReport = z.infer<typeof reportSchema>;
export const metricLabels: Record<keyof OperationsReport['metrics'],string> = {
    inspections:'Inspections submitted',inspection_completion:'Inspection coverage (%)',damage_reports:'Damage reports',damage_value:'Approved damage value (₹)',tasks:'Tasks created',task_completion:'Task completion (%)',audit_score:'Average audit score (%)',checklist_compliance:'Checklist compliance (%)',incidents:'Incidents reported',tester_usage:'Tester usage (percentage points)',
};

export function reportRange(period:string,date:string):{from:string;to:string} {
    const day = new Date(date+'T12:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==date) throw new Error('Choose a valid report date.');
    const from = new Date(day); const to = new Date(day);
    if(period==='week') { const offset=(day.getUTCDay()+6)%7;from.setUTCDate(day.getUTCDate()-offset);to.setTime(from.getTime());to.setUTCDate(from.getUTCDate()+6); }
    else if(period==='month') {from.setUTCDate(1);to.setUTCMonth(to.getUTCMonth()+1,0);}
    else if(period!=='day') throw new Error('Choose daily, weekly, or monthly reports.');
    return {from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)};
}
