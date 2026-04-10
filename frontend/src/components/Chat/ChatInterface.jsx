import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, RotateCcw, Plus, MessageSquare, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'
import { streamChat, chatApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const WELCOME = `Xin chào! Tôi là **AI Content Agent** của NOVIVO 🚀

Tôi có **6 nhóm kỹ năng** — bấm vào tab bên dưới để xem gợi ý:

📅 **Lập kế hoạch** — Lịch tuần, ý tưởng anti-duplicate, kế hoạch theo chủ đề
✍️ **Viết kịch bản** — Tạo mới, viết lại theo style khác (hài, drama, tutorial, POV...)
🔥 **Xu hướng** — Tìm trend thực tế từ internet, phân tích viral content
📊 **Phân tích** — Thống kê dự án, khoảng trống nội dung, ưu tiên công việc
🏷️ **Hashtag & Hook** — Tạo hashtag viral, câu hook 3 giây mạnh
🔧 **Quản lý** — Cập nhật trạng thái Kanban, xóa, tìm kiếm theo bộ lọc

Tôi có **quyền đọc và ghi dữ liệu thật** — tạo ý tưởng, lưu kịch bản, cập nhật Kanban trực tiếp từ chat.`

// Group flat messages into sessions (gap > 30 min = new session)
function groupIntoSessions(msgs) {
  if (!msgs.length) return []
  const GAP = 30 * 60 * 1000
  const sessions = []
  let current = [msgs[0]]

  for (let i = 1; i < msgs.length; i++) {
    const prev = new Date(msgs[i - 1].created_at).getTime()
    const curr = new Date(msgs[i].created_at).getTime()
    if (curr - prev > GAP) {
      sessions.push(current)
      current = []
    }
    current.push(msgs[i])
  }
  sessions.push(current)

  return sessions.map((msgs, idx) => {
    const firstUser = msgs.find((m) => m.role === 'user')
    const title = firstUser
      ? firstUser.content.slice(0, 50) + (firstUser.content.length > 50 ? '…' : '')
      : `Hội thoại ${idx + 1}`
    return {
      id: msgs[0].created_at,
      title,
      date: new Date(msgs[0].created_at),
      messages: msgs.map((m) => ({ id: m.id, role: m.role, content: m.content })),
    }
  }).reverse() // newest first
}

function formatSessionDate(date) {
  const now = new Date()
  const diff = now - date
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return 'Hôm nay'
  if (diff < 2 * day) return 'Hôm qua'
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export default function ChatInterface({ scriptId = null, scriptContext = '' }) {
  const [messages, setMessages] = useState([
    { id: 0, role: 'assistant', content: WELCOME },
  ])
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null) // null = new chat
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const r = await chatApi.getHistory(200)
      const grouped = groupIntoSessions(r.data || [])
      setSessions(grouped)
    } catch {
      // silent — user might not have history yet
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const openSession = (session) => {
    setActiveSession(session.id)
    setMessages(session.messages)
  }

  const newChat = () => {
    setActiveSession(null)
    setMessages([{ id: 0, role: 'assistant', content: WELCOME }])
  }

  const handleSend = async (text) => {
    if (!text.trim() || isStreaming) return

    // If viewing old session, switch to new chat first
    if (activeSession !== null) {
      setActiveSession(null)
      setMessages([{ id: 0, role: 'assistant', content: WELCOME }])
      // let state settle
      await new Promise((r) => setTimeout(r, 0))
    }

    const userMsg = { id: Date.now(), role: 'user', content: text }
    const aiMsg  = { id: Date.now() + 1, role: 'assistant', content: '' }

    setMessages((prev) => [...prev, userMsg, aiMsg])
    setIsStreaming(true)

    const history = messages
      .filter((m) => m.id !== 0)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      for await (const chunk of streamChat({ message: text, history, scriptId, scriptContext })) {
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsg.id ? { ...m, content: m.content + chunk } : m)
        )
      }
      // refresh sessions after sending
      loadHistory()
    } catch {
      toast.error('Lỗi kết nối AI. Vui lòng kiểm tra backend.')
      setMessages((prev) => prev.filter((m) => m.id !== aiMsg.id))
    } finally {
      setIsStreaming(false)
    }
  }

  const clearChat = () => {
    setActiveSession(null)
    setMessages([{ id: 0, role: 'assistant', content: WELCOME }])
  }

  // Group sessions by date label
  const sessionsByDate = sessions.reduce((acc, s) => {
    const label = formatSessionDate(s.date)
    if (!acc[label]) acc[label] = []
    acc[label].push(s)
    return acc
  }, {})

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── History Sidebar ─────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            key="history-sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 border-r flex flex-col overflow-hidden"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}
          >
            {/* Sidebar header */}
            <div className="px-3 pt-3 pb-2 flex items-center gap-2 flex-shrink-0">
              <button
                onClick={newChat}
                className="flex-1 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 transition-all border border-brand-500/30"
              >
                <Plus size={13} />
                Chat mới
              </button>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-secondary text-center py-6 px-3">Chưa có lịch sử chat</p>
              ) : (
                Object.entries(sessionsByDate).map(([label, group]) => (
                  <div key={label} className="mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-secondary px-2 mb-1 flex items-center gap-1">
                      <Clock size={9} /> {label}
                    </p>
                    {group.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => openSession(session)}
                        className={cn(
                          'w-full text-left px-3 py-2 rounded-xl text-xs transition-all mb-0.5 flex items-start gap-2',
                          activeSession === session.id
                            ? 'bg-brand-500/15 text-brand-300 border border-brand-500/30'
                            : 'text-secondary hover:bg-white/5 hover:text-primary border border-transparent'
                        )}
                      >
                        <MessageSquare size={11} className="flex-shrink-0 mt-0.5 opacity-60" />
                        <span className="line-clamp-2 leading-relaxed">{session.title}</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Chat ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="btn-icon text-secondary hover:text-primary"
              title={sidebarOpen ? 'Ẩn lịch sử' : 'Hiện lịch sử'}
            >
              {sidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
            </button>
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center">
              <Sparkles size={13} className="text-white" />
            </div>
            <span className="font-semibold text-sm text-primary">AI Content Agent</span>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" title="Online" />
            {activeSession !== null && (
              <span className="text-[11px] text-secondary ml-1">(xem lại)</span>
            )}
          </div>
          <button onClick={clearChat} className="btn-ghost text-xs flex items-center gap-1.5">
            <RotateCcw size={13} />
            Chat mới
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={isStreaming && msg === messages[messages.length - 1]}
              />
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {activeSession === null ? (
          <div className="flex-shrink-0 p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <ChatInput onSend={handleSend} disabled={isStreaming} />
          </div>
        ) : (
          <div className="flex-shrink-0 p-4 border-t flex items-center justify-center gap-3" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs text-secondary">Đang xem hội thoại cũ</p>
            <button onClick={newChat} className="text-xs px-3 py-1.5 rounded-lg bg-brand-600/20 text-brand-300 hover:bg-brand-600/30 flex items-center gap-1.5 border border-brand-500/30">
              <Plus size={12} /> Chat mới
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

