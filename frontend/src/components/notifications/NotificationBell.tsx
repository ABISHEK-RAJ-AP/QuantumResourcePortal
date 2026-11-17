import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'

import {
  GOVERN_NOTICES_EVENT,
  unreadGovernNoticeCount,
} from '@/lib/governNotices'
import { openNotificationPanel } from '@/lib/notificationPanel'

export function NotificationBell() {
  const [unread, setUnread] = useState(() => unreadGovernNoticeCount())

  const refresh = useCallback(() => setUnread(unreadGovernNoticeCount()), [])

  useEffect(() => {
    refresh()
    const onEvt = () => refresh()
    const onOpen = () => openNotificationPanel()
    window.addEventListener(GOVERN_NOTICES_EVENT, onEvt)
    window.addEventListener('govern:open-notices', onOpen)
    return () => {
      window.removeEventListener(GOVERN_NOTICES_EVENT, onEvt)
      window.removeEventListener('govern:open-notices', onOpen)
    }
  }, [refresh])

  return (
    <button
      type="button"
      className="qre-notify-bell"
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      onClick={() => openNotificationPanel()}
    >
      <Bell size={18} strokeWidth={2} aria-hidden />
      {unread > 0 ? (
        <span className="qre-notify-bell__badge">{unread > 99 ? '99+' : unread}</span>
      ) : null}
    </button>
  )
}