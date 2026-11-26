import type { TaskWithRelations } from '@/lib/store-ops/types';
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import TaskDetail from '@/components/store-ops/tasks/TaskDetail'

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
      assigned_to_profile:profiles!assigned_to(full_name),
      assigned_by_profile:profiles!assigned_by(full_name),
      task_comments(*, profiles:profiles!created_by(full_name)),
      task_attachments(*)
    `)
    .eq('id', id)
    .single()

  if (error || !task) notFound()

  return (
    <TaskDetail
      task={task as TaskWithRelations}
      userRole={profile?.role || 'employee'}
      basePath="/admin/store-operations/tasks"
    />
  )
}
