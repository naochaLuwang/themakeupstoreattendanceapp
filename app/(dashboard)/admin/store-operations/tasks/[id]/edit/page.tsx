import { notFound } from 'next/navigation';
import { operationsContext } from '@/lib/store-ops/context';
import TaskForm from '@/components/store-ops/tasks/TaskForm';
export default async function EditTask({params}:{params:Promise<{id:string}>}) { const {id}=await params; const {supabase}=await operationsContext('tasks.edit');const {data,error}=await supabase.from('tasks').select('*').eq('id',id).single();if(error||!data)notFound();return <TaskForm initialData={data} basePath="/admin/store-operations/tasks" />; }
