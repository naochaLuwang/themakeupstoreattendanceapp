import {getAttendanceDate} from '@/lib/attendance/date';
import {reportRange} from '@/lib/store-ops/report-model';
import {getOperationsReport} from '@/lib/store-ops/reports';
import {operationsContext} from '@/lib/store-ops/context';
import OperationsReportView from '@/components/store-ops/OperationsReportView';
export default async function Reports({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
    const search=await searchParams;const period=typeof search.period==='string'?search.period:'month';const date=typeof search.date==='string'?search.date:getAttendanceDate();const store=typeof search.store==='string'?search.store:'';
    const {from,to}=reportRange(period,date);const {supabase,profile}=await operationsContext();
    let query=supabase.from('stores').select('id,name').order('name');if(profile.role!=='admin')query=query.eq('id',profile.store_id||'');
    const [report,stores]=await Promise.all([getOperationsReport(from,to,store),query]);if(stores.error)throw new Error('Stores could not be loaded.');
    return <OperationsReportView report={report} from={from} to={to} period={period} date={date} store={store} stores={stores.data||[]}/>;
}
