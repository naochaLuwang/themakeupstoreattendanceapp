import type { TaskWithRelations } from '@/lib/store-ops/types';
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TaskList from '@/components/store-ops/tasks/TaskList'


export default async function EmployeeTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, count, error: loadError } = await supabase
    .from('tasks')
    .select(`
      *,
      assigned_to_profile:profiles!assigned_to(full_name),
      assigned_by_profile:profiles!assigned_by(full_name),
      task_comments(*, profiles:profiles!created_by(full_name)),
      task_attachments(*)
    `, { count: 'exact' })
    .eq('assigned_to', user.id)
    .order('created_at', { ascending: false })
    .range(0, 19)

  if(loadError)throw new Error('Store operations records could not be loaded.');
  return (
    <div className="space-y-6">
      <TaskList
        initialData={(data || []) as TaskWithRelations[]}
        total={count || 0}
        page={1}
        totalPages={Math.ceil((count || 0) / 20)}
        basePath="/employee/store-operations/tasks"
        canCreate={false}
        assignedTo={user.id}
      />
    </div>
  )
}
