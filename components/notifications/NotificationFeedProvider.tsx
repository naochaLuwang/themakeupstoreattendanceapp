'use client';

import { createContext, useContext } from 'react';
import { useNotificationFeed } from '@/lib/notifications/useNotificationFeed';

const NotificationFeedContext = createContext<ReturnType<typeof useNotificationFeed> | null>(null);

/** Mobile and desktop header controls share one query/subscription and unread state. */
export default function NotificationFeedProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
    const feed = useNotificationFeed(userId);
    return <NotificationFeedContext.Provider value={feed}>{children}</NotificationFeedContext.Provider>;
}

export function useSharedNotificationFeed() { return useContext(NotificationFeedContext); }
