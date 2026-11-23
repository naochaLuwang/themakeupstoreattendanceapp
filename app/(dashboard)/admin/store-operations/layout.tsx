import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StoreOpsNav from './StoreOpsNav'

export default async function StoreOperationsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role || 'employee'

  return (
    <div className="space-y-6">
      <StoreOpsNav role={role} />
      {children}
    </div>
  )
}
