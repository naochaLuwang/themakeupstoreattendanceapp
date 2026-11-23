import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import TaskDetail from '@/components/store-ops/tasks/TaskDetail'

export default async function EmployeeTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: task, error } = await supabase
    .from('tasks')
    .select(`
      *,
      assigned_to_profile:assigned_to(full_name),
      assigned_by_profile:assigned_by(full_name),
      task_comments(*, profiles:created_by(full_name)),
      task_attachments(*)
    `)
    .eq('id', id)
    .single()

  if (error || !task) notFound()

  return (
    <div className="space-y-6">
      <TaskDetail
        task={task as any}
        userRole={profile?.role || 'employee'}
        basePath="/employee/store-operations/tasks"
      />
    </div>
  )
}
