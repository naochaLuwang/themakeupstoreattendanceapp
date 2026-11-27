'use client';
import NotificationPanel from './NotificationPanel';
import OperationsNotificationPreferences from './OperationsNotificationPreferences';

export default function OperationsNotifications({ userId, initial }: { userId: string; initial: { enabled: boolean; push_enabled: boolean } }) {
    return <div className="attendance-notifications"><h1 className="text-2xl font-medium">Operations notifications</h1><OperationsNotificationPreferences key={userId} userId={userId} initial={initial} /><NotificationPanel userId={userId} embedded operationsOnly /></div>;
}
