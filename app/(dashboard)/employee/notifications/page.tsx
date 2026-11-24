import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AttendanceNotificationPreferences from '@/components/notifications/AttendanceNotificationPreferences';
export const metadata = { title: 'Notifications' };
export default async function NotificationPage() {
    const client = await createClient(); const { data: { user } } = await client.auth.getUser();
    if (!user) redirect('/login');
    return <div className="employee-screen space-y-6"><header className="employee-page-heading"><h1>Notifications</h1><p>Shift reminders, device settings and your reminder history.</p></header><AttendanceNotificationPreferences key={user.id} userId={user.id} /></div>;
}
