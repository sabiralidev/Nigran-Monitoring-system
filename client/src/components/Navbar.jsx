import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Activity, Wifi, WifiOff } from 'lucide-react'
import { useSocket } from '../context/SocketContext'
import { useState, useRef, useEffect } from 'react'
import { useUnreadCount } from '../hooks/useAlerts'
import { normalizeProfileImageUrl } from '../utils/avatar'

const Navbar = () => {
  const { connected, unreadCount: socketUnread, recentAlerts, clearNotifications } = useSocket()
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef(null)

  const { data: unreadData } = useUnreadCount()
  const totalUnread = socketUnread + (unreadData?.count || 0)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const getActivityIcon = (type) => {
    const icons = {
      tweet: '✍️', retweet: '🔁', reply: '💬', image: '🖼️',
      video: '🎥', thread: '🧵', quote: '❝'
    }
    return icons[type] || '📌'
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-dark-200 border-b border-border backdrop-blur-sm">
      <div className="h-full flex items-center justify-between px-6">
        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-cyan flex items-center justify-center">
            <Activity size={16} className="text-white" />
          </div>
          <span className="font-bold text-lg text-gradient">Monitoring-X</span>
        </Link>

        {/* Center status */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
            connected
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : 'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>{connected ? 'Live' : 'Disconnected'}</span>
            {connected && <span className="w-1.5 h-1.5 bg-green-400 rounded-full pulse-dot" />}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotifications((v) => !v); if (!showNotifications) clearNotifications() }}
              className="relative p-2 rounded-lg hover:bg-dark-100 text-gray-400 hover:text-gray-100 transition-colors"
            >
              <Bell size={20} />
              {totalUnread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-accent-red text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1"
                >
                  {totalUnread > 99 ? '99+' : totalUnread}
                </motion.span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-80 bg-dark-100 border border-border rounded-xl shadow-2xl overflow-hidden"
                >
                  <div className="p-3 border-b border-border flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-200">Recent Alerts</span>
                    <Link
                      to="/alerts"
                      className="text-xs text-accent-blue hover:underline"
                      onClick={() => setShowNotifications(false)}
                    >
                      View all
                    </Link>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {recentAlerts.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-6">No recent alerts</p>
                    ) : (
                      recentAlerts.slice(0, 8).map((alert) => (
                        <div key={alert._id} className="flex items-start gap-3 p-3 hover:bg-dark-200 transition-colors border-b border-border/50 last:border-0">
                          <img
                            src={
                              normalizeProfileImageUrl(alert.profileImage) ||
                              `https://api.dicebear.com/7.x/avataaars/svg?seed=${alert.username}`
                            }
                            alt={alert.username}
                            className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-blue-400 text-xs font-semibold">@{alert.username}</span>
                              <span className="text-gray-500 text-xs">
                                {{ tweet: '✍️', retweet: '🔁', reply: '💬', image: '🖼️', video: '🎥', thread: '🧵', quote: '❝' }[alert.activityType] || '📌'}
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs line-clamp-1 mt-0.5">{alert.content || `New ${alert.activityType}`}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Navbar
