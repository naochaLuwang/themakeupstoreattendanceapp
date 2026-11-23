import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TaskList from '@/components/store-ops/tasks/TaskList'
import { can } from '@/lib/store-ops/permissions'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'employee'

  const { data, count } = await supabase
    .from('tasks')
    .select(`
      *,
      assigned_to_profile:assigned_to(full_name),
      assigned_by_profile:assigned_by(full_name),
      task_comments(*, profiles:created_by(full_name)),
      task_attachments(*)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(0, 19)

  const employees = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'employee')
    .order('full_name')

  return (
    <TaskList
      initialData={(data || []) as any}
      total={count || 0}
      page={1}
      totalPages={Math.ceil((count || 0) / 20)}
      basePath="/admin/store-operations/tasks"
      canCreate={can(role, 'tasks.create')}
      employees={(employees.data || []) as any}
    />
  )
}
