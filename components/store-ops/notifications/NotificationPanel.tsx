'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, CheckCheck, Loader2, X } from 'lucide-react';
import { notificationPath } from '@/lib/notifications/links';
import { useNotificationFeed } from '@/lib/notifications/useNotificationFeed';
import { useSharedNotificationFeed } from '@/components/notifications/NotificationFeedProvider';
import type { NotificationScope } from '@/lib/notifications/feed';
import './notification-panel.css';

interface NotificationPanelProps {
    userId: string;
    embedded?: boolean;
    attendanceOnly?: boolean;
    operationsOnly?: boolean;
}
type Feed = ReturnType<typeof useNotificationFeed>;

export default function NotificationPanel(props: NotificationPanelProps) {
    const shared = useSharedNotificationFeed();
    if (shared?.userId === props.userId && !props.attendanceOnly && !props.operationsOnly) {
        return <NotificationPanelView {...props} feed={shared} />;
    }
    return <StandaloneNotificationPanel {...props} />;
}

function StandaloneNotificationPanel(props: NotificationPanelProps) {
    const scope: NotificationScope = props.attendanceOnly ? 'attendance' : props.operationsOnly ? 'operations' : 'all';
    const feed = useNotificationFeed(props.userId, scope);
    return <NotificationPanelView {...props} feed={feed} />;
}

function NotificationPanelView({ embedded = false, attendanceOnly = false, feed }: NotificationPanelProps & { feed: Feed }) {
    const router = useRouter();
    const pathname = usePathname();
    const [openedOn, setOpenedOn] = useState<string | null>(null);
    const open = openedOn === pathname;
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const id = useId();
    const title = attendanceOnly ? 'Reminder history' : 'Notifications';
    const label = feed.error ? 'Notifications, could not refresh' : `Notifications${feed.unreadCount ? `, ${feed.unreadCount} unread` : ''}`;

    useEffect(() => {
        if (!open || embedded) return;
        headingRef.current?.focus();
        const outside = (event: PointerEvent) => {
            if (event.target instanceof Node && !panelRef.current?.contains(event.target)) setOpenedOn(null);
        };
        document.addEventListener('pointerdown', outside);
        return () => document.removeEventListener('pointerdown', outside);
    }, [open, embedded]);

    return <div className="notification-feed" ref={panelRef} onBlur={event => {
        if (open && !event.currentTarget.contains(event.relatedTarget)) setOpenedOn(null);
    }} onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); setOpenedOn(null); buttonRef.current?.focus(); }
    }}>
        {!embedded && <button ref={buttonRef} type="button" className="notification-bell" aria-label={label} title={label}
            aria-expanded={open} aria-controls={open ? `${id}-panel` : undefined} aria-haspopup="dialog"
            onClick={() => { setOpenedOn(open ? null : pathname); if (!open) void feed.refresh(); }}>
            <Bell size={19} strokeWidth={1.6} aria-hidden="true" />
            {feed.unreadCount > 0 && <span className="notification-bell-count" aria-hidden="true">{feed.unreadCount > 99 ? '99+' : feed.unreadCount}</span>}
            {feed.error && <span className="notification-bell-error" aria-hidden="true">!</span>}
        </button>}
        {(open || embedded) && <div id={`${id}-panel`} className={`notification-feed-panel${embedded ? ' notification-feed-embedded' : ''}`}
            role={embedded ? 'region' : 'dialog'} aria-labelledby={`${id}-title`}>
            <div className="notification-feed-heading">
                <h3 ref={headingRef} id={`${id}-title`} tabIndex={-1}>{title}</h3>
                {!embedded && <button type="button" className="notification-close" aria-label="Close notifications" onClick={() => { setOpenedOn(null); buttonRef.current?.focus(); }}><X size={18} aria-hidden="true" /></button>}
            </div>
            {feed.unreadCount > 0 && <div className="notification-feed-tools"><span>{feed.unreadCount} unread</span><button type="button" disabled={feed.busy} onClick={() => void feed.markRead()}><CheckCheck size={16} aria-hidden="true" />Mark all read</button></div>}
            {feed.error && <div className="notification-feed-error" role="alert"><p>{feed.error}</p><button type="button" disabled={feed.busy} onClick={() => void feed.refresh()}>Refresh notifications</button></div>}
            <div className="notification-feed-list" aria-busy={feed.loading}>
                {feed.loading ? <div className="notification-feed-empty" role="status"><Loader2 size={22} className="motion-safe:animate-spin" aria-hidden="true" /><p>Loading notifications…</p></div>
                    : !feed.error && feed.items.length === 0 ? <div className="notification-feed-empty"><Bell size={26} aria-hidden="true" /><p>You’re all caught up</p><span>Assigned tasks and other updates will appear here.</span></div>
                    : feed.items.map(item => <button type="button" key={item.id} disabled={feed.busy} className="notification-feed-item" data-unread={!item.is_read}
                        onClick={async () => {
                            if (!item.is_read && !await feed.markRead(item.id)) return;
                            if (item.link) { router.push(notificationPath(item.link)); setOpenedOn(null); }
                        }}>
                        <span className="notification-unread-dot" aria-hidden="true" />
                        <span className="notification-feed-copy"><strong>{item.title}</strong>{item.body && <span>{item.body}</span>}
                            <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time>
                            {!item.is_read && <span className="sr-only">Unread</span>}
                        </span>
                    </button>)}
            </div>
            {!embedded && <div className="notification-feed-footer"><Link href="/employee/notifications" onClick={() => setOpenedOn(null)}>Notification settings</Link></div>}
        </div>}
    </div>;
}
