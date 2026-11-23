import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { can } from '@/lib/store-ops/permissions'
import TaskForm from '@/components/store-ops/tasks/TaskForm'

export default async function NewTaskPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !can(profile.role, 'tasks.create')) {
    redirect('/admin/store-operations/tasks')
  }

  return <TaskForm basePath="/admin/store-operations/tasks" />
}
