import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { notificationAdmin } from '@/lib/notifications/server';
import { notificationProviders } from '@/lib/notifications/config';
import AttendanceReminderManagement from '@/components/notifications/AttendanceReminderManagement';
import AttendanceNotificationPreferences from '@/components/notifications/AttendanceNotificationPreferences';
export const metadata = { title: 'Attendance notifications' };
export default async function AttendanceNotificationPage() {
    const client = await createClient(); const { data: { user } } = await client.auth.getUser();
    if (!user) redirect('/login');
    const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return <div role="alert"><h1>Administrator access required</h1><p>An administrator configures branch reminder timing.</p></div>;
    return <div className="space-y-8"><header><h1>Attendance notifications</h1><p>Branch reminder timing, delivery status and your notification preferences.</p></header><AttendanceReminderManagement initial={await notificationAdmin({ action: 'list' })} providers={notificationProviders()} /><AttendanceNotificationPreferences userId={user.id} /></div>;
}
