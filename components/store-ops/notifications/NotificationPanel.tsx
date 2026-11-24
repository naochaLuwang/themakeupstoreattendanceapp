'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { notificationPath } from '@/lib/notifications/links'
import { Bell, CheckCheck, Loader2, ExternalLink } from 'lucide-react'
import type { NotificationLog } from '@/lib/store-ops/database.types'
import { markAsRead as markAsReadAction, markAllAsRead as markAllAsReadAction } from '@/app/actions/store-ops/notifications'
import { toast } from 'sonner'

interface NotificationPanelProps {
  userId: string
  embedded?: boolean
  attendanceOnly?: boolean
}

export default function NotificationPanel({ userId, embedded = false, attendanceOnly = false }: NotificationPanelProps) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    let query = supabase
      .from('notification_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (attendanceOnly) query = query.not('attendance_reminder_id', 'is', null)
    const { data, error } = await query

    if (!error && data) {
      setLoadError(null)
      setNotifications(data as NotificationLog[])
      setUnreadCount(data.filter(n => !n.is_read).length)
    } else setLoadError('Notifications could not be loaded. Refresh to try again.')
    setLoading(false)
  }, [userId, supabase, attendanceOnly])

  useEffect(() => {
    fetchNotifications()
    window.addEventListener('hrm:notification', fetchNotifications)
    return () => window.removeEventListener('hrm:notification', fetchNotifications)
  }, [fetchNotifications])

  useEffect(() => {
    const channel = supabase.channel('notifications_realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notification_log', filter: `user_id=eq.${userId}` },
        () => { fetchNotifications() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, fetchNotifications, supabase])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleMarkAsRead(id: string, link?: string | null) {
    const result = await markAsReadAction(id)
    if (!result.success) { toast.error(result.error || 'Could not mark the notification as read'); return }
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
    if (link) {
      router.push(notificationPath(link, '/'))
      setOpen(false)
    }
  }

  async function handleMarkAllRead() {
    const result = await markAllAsReadAction(userId)
    if (result.success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } else {
      toast.error(result.error || 'Failed to mark all as read')
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  return (
    <div ref={panelRef} className="relative">
      {!embedded && <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors"
      >
        <Bell size={18} className="text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[7px] font-black flex items-center justify-center rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>}

      {(open || embedded) && (
        <div className={embedded ? 'notification-card notification-history' : 'absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50'}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
              {attendanceOnly ? 'Reminder history' : 'Notifications'}
              {unreadCount > 0 && (
                <span className="ml-1.5 text-slate-400">({unreadCount})</span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[9px] font-bold text-slate-400 hover:text-slate-900 transition-colors"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-12 flex justify-center">
                <Loader2 size={18} className="animate-spin text-slate-300" />
              </div>
            ) : loadError ? <div role="alert" className="notification-error"><p>{loadError}</p><button type="button" onClick={() => void fetchNotifications()}>Refresh history</button></div> : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={24} className="mx-auto text-slate-200 mb-2" />
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleMarkAsRead(n.id, n.link)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                    !n.is_read ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      n.is_read ? 'bg-transparent' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] ${n.is_read ? 'font-bold text-slate-500' : 'font-black text-slate-900'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] font-bold text-slate-400">{timeAgo(n.created_at)}</span>
                        {n.link && (
                          <ExternalLink size={8} className="text-slate-300" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
