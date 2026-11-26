import {notFound} from 'next/navigation';
import {operationsContext} from '@/lib/store-ops/context';
import RestockForm from '@/components/store-ops/restocking/RestockForm';
export default async function EditRestock({params}:{params:Promise<{id:string}>}){const{id}=await params;const{supabase}=await operationsContext('restock.approve');const{data,error}=await supabase.from('restock_requests').select('*,restock_items(*)').eq('id',id).eq('status','pending').single();if(error||!data)notFound();return <RestockForm initialData={data}/>;}
