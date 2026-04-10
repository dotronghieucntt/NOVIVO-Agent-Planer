import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarPlus, MessageSquare, TrendingUp, Video, PanelRight } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { contentApi, planningApi } from '@/lib/api'
import { formatDate, STATUS_COLORS, KANBAN_STATUSES } from '@/lib/utils'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { setRightPanelOpen } = useOutletContext()
  const [kanban, setKanban] = useState({})
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      contentApi.getKanban(),
      planningApi.getHistory({ limit: 5 }),
    ])
      .then(([k, h]) => {
        setKanban(k.data)
        setHistory(h.data.items || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const totalScripts = KANBAN_STATUSES.reduce((sum, s) => sum + (kanban[s]?.length || 0), 0)
  const published = kanban['Đã đăng']?.length || 0
  const inProgress = (kanban['Đang tạo AI']?.length || 0) + (kanban['Hoàn thiện']?.length || 0)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            Xin chào, <span className="gradient-text">{user?.full_name || user?.username}</span> 👋
          </h1>
          <p className="text-sm text-secondary mt-1">{formatDate(new Date().toISOString())} · Hôm nay bạn định tạo gì?</p>
        </div>
        <button onClick={() => setRightPanelOpen((v) => !v)} className="btn-ghost flex items-center gap-2">
          <PanelRight size={16} />
          <span className="hidden md:block text-sm">Thông số</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Tổng kịch bản', value: totalScripts, icon: Video, color: 'from-violet-500 to-purple-600' },
          { label: 'Đang sản xuất', value: inProgress, icon: TrendingUp, color: 'from-yellow-500 to-orange-500' },
          { label: 'Đã đăng', value: published, icon: CalendarPlus, color: 'from-green-500 to-emerald-600' },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-secondary font-semibold uppercase tracking-wide">{label}</p>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                <Icon size={16} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold text-primary">{loading ? '—' : value}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => navigate('/planning')}
          className="glass-card p-6 text-left group hover:border-brand-500/40 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center mb-4 shadow-lg group-hover:scale-105 transition-transform">
            <CalendarPlus size={18} className="text-white" />
          </div>
          <h3 className="font-bold text-primary mb-1">Lên kế hoạch hôm nay</h3>
          <p className="text-xs text-secondary">AI tự động tạo 2-3 ý tưởng video không trùng lặp dựa trên trend mới nhất.</p>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          onClick={() => navigate('/workspace')}
          className="glass-card p-6 text-left group hover:border-brand-500/40 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center mb-4 shadow-lg group-hover:scale-105 transition-transform">
            <MessageSquare size={18} className="text-white" />
          </div>
          <h3 className="font-bold text-primary mb-1">Chat với AI Agent</h3>
          <p className="text-xs text-secondary">Tìm trend, viết kịch bản, brainstorm ý tưởng mới bất cứ lúc nào.</p>
        </motion.button>
      </div>

      {/* Recent history */}
      {history.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-sm font-semibold text-primary mb-3">📋 Ý tưởng gần đây</h2>
          <div className="glass-card divide-y" style={{ borderColor: 'var(--border)' }}>
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm text-primary font-medium">{h.topic}</p>
                  {h.angle && <p className="text-xs text-secondary mt-0.5">{h.angle}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_COLORS[h.status] || STATUS_COLORS['Ý tưởng']}`}>
                    {h.status}
                  </span>
                  <span className="text-xs text-secondary">{formatDate(h.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
