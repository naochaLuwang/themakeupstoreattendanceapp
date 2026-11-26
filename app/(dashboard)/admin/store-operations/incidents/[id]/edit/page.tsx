import {notFound} from 'next/navigation';
import {operationsContext} from '@/lib/store-ops/context';
import IncidentForm from '@/components/store-ops/incidents/IncidentForm';
export default async function EditIncident({params}:{params:Promise<{id:string}>}) {const{id}=await params;const{supabase}=await operationsContext('incidents.edit');const{data,error}=await supabase.from('incidents').select('*,incident_images(url)').eq('id',id).single();if(error||!data)notFound();return <IncidentForm initialData={data}/>;}
