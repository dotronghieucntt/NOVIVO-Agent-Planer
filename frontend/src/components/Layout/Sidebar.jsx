import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, MessageSquare, CalendarPlus, Shield,
  LogOut, ChevronRight, Moon, Sun, User, Settings
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { cn, formatDate } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { planningApi } from '@/lib/api'
import logoFull from '/logo-full.png'

const ADMIN_ROLES = ['admin', 'superadmin', 'manager']

const NAV = [
  { path: '/',          label: 'Tổng quan',    icon: LayoutDashboard },
  { path: '/workspace', label: 'Workspace',    icon: MessageSquare },
  { path: '/planning',  label: 'Lên kế hoạch', icon: CalendarPlus },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [recentHistory, setRecentHistory] = useState([])

  useEffect(() => {
    planningApi.getHistory({ limit: 5 })
      .then((r) => setRecentHistory(r.data.items || []))
      .catch(() => {})
  }, [])

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col h-full border-r"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2">
        <img src={logoFull} alt="NOVIVO" className="h-20 object-contain" />
      </div>

      {/* Nav */}
      <nav className="px-3 flex flex-col gap-1">
        {NAV.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={cn('sidebar-item', pathname === path && 'active')}
          >
            <Icon size={16} />
            <span>{label}</span>
            {pathname === path && (
              <motion.div layoutId="nav-indicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />
            )}
          </button>
        ))}

        {ADMIN_ROLES.includes(user?.role) && (
          <button
            onClick={() => navigate('/admin')}
            className={cn('sidebar-item', pathname === '/admin' && 'active')}
          >
            <Shield size={16} />
            <span>Admin</span>
            {pathname === '/admin' && (
              <motion.div layoutId="nav-indicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />
            )}
          </button>
        )}

        {ADMIN_ROLES.includes(user?.role) && (
          <button
            onClick={() => navigate('/settings')}
            className={cn('sidebar-item', pathname === '/settings' && 'active')}
          >
            <Settings size={16} />
            <span>Cài đặt</span>
            {pathname === '/settings' && (
              <motion.div layoutId="nav-indicator" className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />
            )}
          </button>
        )}
      </nav>

      {/* Recent History */}
      <div className="px-3 mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary px-2 mb-2">
          Gần đây
        </p>
        <div className="flex flex-col gap-0.5">
          {recentHistory.map((h) => (
            <button
              key={h.id}
              className="sidebar-item text-left"
              onClick={() => navigate('/workspace')}
            >
              <ChevronRight size={12} className="flex-shrink-0" />
              <span className="truncate text-xs">{h.topic}</span>
            </button>
          ))}
          {recentHistory.length === 0 && (
            <p className="text-xs text-secondary px-2 py-1">Chưa có lịch sử</p>
          )}
        </div>
      </div>

      <div className="mt-auto px-3 pb-4 flex flex-col gap-1">
        {/* Theme toggle */}
        <button onClick={toggle} className="sidebar-item">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* User info */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1"
          style={{ background: 'rgba(139,92,246,0.08)' }}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user?.full_name?.[0] || user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary truncate">
              {user?.full_name || user?.username}
            </p>
            <p className="text-[11px] text-secondary capitalize">{user?.role}</p>
          </div>
          <button onClick={logout} className="btn-icon" title="Đăng xuất">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
