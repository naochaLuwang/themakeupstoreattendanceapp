import 'server-only';
import { operationsContext } from './context';
import { reportSchema } from './report-model';
import { uuid } from './validation';

export async function getOperationsReport(from:string,to:string,store?:string) {
    const {supabase,profile}=await operationsContext();
    if(profile.role!=='admin'&&profile.role!=='manager')throw new Error('Manager permission required.');
    if(store)uuid.parse(store);
    const {data,error}=await supabase.rpc('store_ops_report',{p_from:from,p_to:to,p_store:store||null});
    if(error)throw new Error('The operations report could not be loaded. Check the date range and retry.');
    const parsed=reportSchema.safeParse(data);
    if(!parsed.success)throw new Error('The operations report returned incomplete data.');
    return parsed.data;
}
