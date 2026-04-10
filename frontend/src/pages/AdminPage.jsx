import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, BookOpen, BarChart3, Plus, Trash2, UserCheck, UserX,
  Loader2, Shield, Activity, Pencil, X, Save, Eye, ChevronRight,
  Globe, CheckCircle
} from 'lucide-react'
import { adminApi, sourcesApi, authApi } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'stats',     label: 'Tổng quan',    icon: BarChart3 },
  { id: 'users',     label: 'Nhân viên',    icon: Users },
  { id: 'knowledge', label: 'Kiến thức AI', icon: BookOpen },
]

export default function AdminPage() {
  const [tab, setTab] = useState('stats')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  // Forms
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', full_name: '', role: 'staff' })
  const [newDoc, setNewDoc] = useState({ title: '', category: 'brand_voice', content: '' })
  const [submitting, setSubmitting] = useState(false)

  // Sources (groups)
  const [sources, setSources] = useState([])
  const [selectedSource, setSelectedSource] = useState(null)
  const [showAddSource, setShowAddSource] = useState(false)
  const [newSource, setNewSource] = useState({ name: '', description: '' })

  // Docs per source
  const [sourceDocs, setSourceDocs] = useState([])
  const [sourceDocLoading, setSourceDocLoading] = useState(false)

  // Knowledge panel state
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editDraft, setEditDraft] = useState(null)
  const [docLoading, setDocLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Crawl state
  const [showCrawlForm, setShowCrawlForm] = useState(false)
  const [crawlForm, setCrawlForm] = useState({ url: '', category: 'other', max_pages: 30, max_depth: 2 })
  const [crawling, setCrawling] = useState(false)
  const [crawlResult, setCrawlResult] = useState(null)

  useEffect(() => {
    if (tab === 'stats') {
      adminApi.getStats().then((r) => setStats(r.data)).catch(() => {})
    } else if (tab === 'users') {
      setLoading(true)
      authApi.listUsers()
        .then((r) => {
          // NOVIVO returns { success, data: [...] } or flat array
          const list = Array.isArray(r.data) ? r.data : (r.data?.data || [])
          setUsers(list)
        })
        .catch(() => toast.error('Không tải được danh sách nhân viên'))
        .finally(() => setLoading(false))
    } else if (tab === 'knowledge') {
      setLoading(true)
      sourcesApi.list()
        .then((r) => setSources(r.data))
        .catch(() => toast.error('Không tải được danh sách nguồn'))
        .finally(() => setLoading(false))
    }
  }, [tab])

  const toggleUser = async (user) => {
    await adminApi.updateUser(user.id, { is_active: !user.is_active })
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
  }

  const createUser = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await authApi.register({
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        fullName: newUser.full_name,
        role: newUser.role === 'admin' ? 'admin' : 'employee',
      })
      toast.success('Tạo tài khoản thành công!')
      setNewUser({ username: '', email: '', password: '', full_name: '', role: 'staff' })
      authApi.listUsers().then((r) => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.data || [])
        setUsers(list)
      }).catch(() => {})
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.detail || 'Lỗi tạo tài khoản')
    } finally {
      setSubmitting(false)
    }
  }

  const addDoc = async (e) => {
    e.preventDefault()
    if (!newDoc.content.trim()) return
    setSubmitting(true)
    try {
      await adminApi.addKnowledge({ ...newDoc, source_id: selectedSource?.id ?? null })
      toast.success('Đã thêm tài liệu!')
      const refreshed = await adminApi.listKnowledge({ source_id: selectedSource?.id })
      setSourceDocs(refreshed.data)
      setSources(prev => prev.map(s => s.id === selectedSource?.id ? { ...s, doc_count: refreshed.data.length } : s))
      setNewDoc({ title: '', category: 'brand_voice', content: '' })
      setShowAddForm(false)
    } catch {
      toast.error('Lỗi thêm tài liệu')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteDoc = async (id) => {
    if (!confirm('Xóa tài liệu này khỏi Knowledge Base?')) return
    await adminApi.deleteKnowledge(id)
    setSourceDocs((prev) => prev.filter((d) => d.id !== id))
    setSources(prev => prev.map(s => s.id === selectedSource?.id ? { ...s, doc_count: Math.max(0, s.doc_count - 1) } : s))
    if (selectedDoc?.id === id) setSelectedDoc(null)
    toast.success('Đã xóa')
  }

  const openDoc = async (doc) => {
    setEditMode(false)
    setDocLoading(true)
    setSelectedDoc(doc)
    setShowAddForm(false)
    setShowCrawlForm(false)
    try {
      const res = await adminApi.getKnowledge(doc.id)
      setSelectedDoc(res.data)
    } catch {
      toast.error('Không thể tải nội dung')
    } finally {
      setDocLoading(false)
    }
  }

  // ─── Source management ────────────────────────────────────────────────────

  const selectSource = async (src) => {
    setSelectedSource(src)
    setSelectedDoc(null)
    setShowAddForm(false)
    setShowCrawlForm(false)
    setCrawlResult(null)
    setSourceDocLoading(true)
    try {
      const r = await adminApi.listKnowledge({ source_id: src.id })
      setSourceDocs(r.data)
    } finally {
      setSourceDocLoading(false)
    }
  }

  const toggleSource = async (src, e) => {
    e.stopPropagation()
    const newActive = src.is_active ? 0 : 1
    await sourcesApi.update(src.id, { is_active: newActive })
    setSources(prev => prev.map(s => s.id === src.id ? { ...s, is_active: Boolean(newActive) } : s))
    toast.success(newActive ? 'Nguồn đã được kích hoạt' : 'Nguồn đã tắt')
  }

  const createSource = async (e) => {
    e.preventDefault()
    if (!newSource.name.trim()) return
    setSubmitting(true)
    try {
      const r = await sourcesApi.create(newSource)
      setSources(prev => [...prev, r.data])
      setNewSource({ name: '', description: '' })
      setShowAddSource(false)
      toast.success('Đã tạo nhóm nguồn!')
    } catch {
      toast.error('Lỗi tạo nhóm')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteSource = async (src, e) => {
    e.stopPropagation()
    if (!confirm(`Xóa nhóm "${src.name}"?\nCác tài liệu trong nhóm sẽ không bị xóa.`)) return
    await sourcesApi.delete(src.id)
    setSources(prev => prev.filter(s => s.id !== src.id))
    if (selectedSource?.id === src.id) {
      setSelectedSource(null)
      setSourceDocs([])
      setSelectedDoc(null)
    }
    toast.success('Đã xóa nhóm nguồn')
  }

  const crawlUrl = async () => {
    if (!crawlForm.url.trim()) return
    setCrawling(true)
    try {
      const res = await adminApi.crawlKnowledge({ ...crawlForm, source_id: selectedSource?.id ?? null })
      setCrawlResult(res.data)
      toast.success(`Crawl xong! Đã thêm ${res.data.added} trang vào nhóm`)
      const refreshed = await adminApi.listKnowledge({ source_id: selectedSource?.id })
      setSourceDocs(refreshed.data)
      setSources(prev => prev.map(s => s.id === selectedSource?.id ? { ...s, doc_count: refreshed.data.length } : s))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Lỗi khi crawl URL')
    } finally {
      setCrawling(false)
    }
  }

  const startEdit = () => {
    setEditDraft({ title: selectedDoc.title, category: selectedDoc.category, content: selectedDoc.content })
    setEditMode(true)
  }

  const saveEdit = async () => {
    setSubmitting(true)
    try {
      await adminApi.updateKnowledge(selectedDoc.id, editDraft)
      const updated = { ...selectedDoc, ...editDraft }
      setSelectedDoc(updated)
      setSourceDocs((prev) => prev.map((d) => d.id === selectedDoc.id ? { ...d, ...editDraft } : d))
      setEditMode(false)
      toast.success('Đã cập nhật tài liệu!')
    } catch {
      toast.error('Lỗi cập nhật')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <Shield size={20} className="text-brand-400" />
        <h1 className="font-bold text-lg text-primary">Admin Panel</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all border-b-2 ${
              tab === id ? 'text-brand-300 border-brand-500' : 'text-secondary border-transparent hover:text-primary'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* STATS */}
        {tab === 'stats' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Người dùng', value: stats.total_users, icon: Users },
                { label: 'Kịch bản', value: stats.total_scripts, icon: Activity },
                { label: 'Ý tưởng', value: stats.total_topics, icon: BarChart3 },
                { label: 'Tài liệu AI', value: stats.total_knowledge_docs, icon: BookOpen },
              ].map(({ label, value, icon: Icon }, i) => (
                <div key={label} className="glass-card p-4">
                  <Icon size={18} className="text-brand-400 mb-2" />
                  <p className="text-2xl font-bold text-primary">{value}</p>
                  <p className="text-xs text-secondary">{label}</p>
                </div>
              ))}
            </div>

            <div className="glass-card p-5">
              <h3 className="font-semibold text-sm text-primary mb-4">Kịch bản theo trạng thái</h3>
              <div className="space-y-3">
                {Object.entries(stats.scripts_by_status || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-sm text-secondary w-28">{status}</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--bg-secondary)' }}>
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-400 transition-all"
                        style={{ width: `${stats.total_scripts > 0 ? (count / stats.total_scripts * 100) : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-primary w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && (
          <div className="grid grid-cols-2 gap-6">
            {/* User list */}
            <div className="glass-card p-5">
              <h3 className="font-semibold text-sm text-primary mb-4">Danh sách tài khoản</h3>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-brand-400" /></div>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u._id || u.id || u.username} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-xs font-bold text-white">
                        {(u.username || u.userName || '?')[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{u.fullName || u.full_name || u.username || u.userName}</p>
                        <p className="text-xs text-secondary capitalize">{u.role} · {u.email}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        u.isActive === false ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'
                      }`}>
                        {u.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create user form */}
            <div className="glass-card p-5">
              <h3 className="font-semibold text-sm text-primary mb-4">Tạo tài khoản mới</h3>
              <form onSubmit={createUser} className="space-y-3">
                {[
                  { key: 'full_name', label: 'Họ và tên', placeholder: 'Nguyễn Văn A' },
                  { key: 'username', label: 'Username', placeholder: 'staff01' },
                  { key: 'email', label: 'Email', placeholder: 'staff@company.com', type: 'email' },
                  { key: 'password', label: 'Mật khẩu', placeholder: '••••••••', type: 'password' },
                ].map(({ key, label, placeholder, type = 'text' }) => (
                  <div key={key}>
                    <label className="text-xs text-secondary block mb-1">{label}</label>
                    <input
                      className="input-base"
                      type={type}
                      placeholder={placeholder}
                      value={newUser[key]}
                      onChange={(e) => setNewUser((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-secondary block mb-1">Vai trò</label>
                  <select className="input-base" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="accountant">Accountant</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Tạo tài khoản
                </button>
              </form>
            </div>
          </div>
        )}

        {/* KNOWLEDGE BASE */}
        {tab === 'knowledge' && (
          <div className="flex gap-3 h-full" style={{ minHeight: 0 }}>

            {/* ── Column 1: Source groups ── */}
            <div className="w-52 flex-shrink-0 glass-card p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <h3 className="font-semibold text-xs text-secondary uppercase tracking-wide">
                  Nhóm nguồn ({sources.length})
                </h3>
                <button
                  onClick={() => setShowAddSource(!showAddSource)}
                  className="btn-icon text-brand-400 p-1"
                  title="Tạo nhóm mới"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Inline add-source form */}
              {showAddSource && (
                <form onSubmit={createSource} className="flex flex-col gap-2 p-2 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                  <input
                    className="input-base text-xs"
                    placeholder="Tên nhóm..."
                    value={newSource.name}
                    onChange={(e) => setNewSource(p => ({ ...p, name: e.target.value }))}
                    autoFocus
                  />
                  <input
                    className="input-base text-xs"
                    placeholder="Mô tả (tuỳ chọn)..."
                    value={newSource.description}
                    onChange={(e) => setNewSource(p => ({ ...p, description: e.target.value }))}
                  />
                  <div className="flex gap-1">
                    <button type="submit" disabled={submitting || !newSource.name.trim()}
                      className="btn-primary flex-1 text-xs py-1.5 flex items-center justify-center gap-1">
                      {submitting ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                      Tạo
                    </button>
                    <button type="button" onClick={() => setShowAddSource(false)} className="btn-icon text-secondary px-2">
                      <X size={12} />
                    </button>
                  </div>
                </form>
              )}

              {loading ? (
                <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-brand-400" /></div>
              ) : sources.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-secondary">
                  <BookOpen size={28} className="opacity-20" />
                  <p className="text-xs text-center">Chưa có nhóm nào</p>
                  <button onClick={() => setShowAddSource(true)} className="text-xs text-brand-400 hover:underline">
                    Tạo nhóm đầu tiên
                  </button>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
                  {sources.map((src) => (
                    <div
                      key={src.id}
                      onClick={() => selectSource(src)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && selectSource(src)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all group cursor-pointer ${
                        selectedSource?.id === src.id
                          ? 'bg-brand-500/20 text-brand-200'
                          : 'hover:bg-white/5 text-primary'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate leading-snug">{src.name}</p>
                          <p className="text-[10px] text-secondary mt-0.5">{src.doc_count} tài liệu</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                          {/* Active toggle */}
                          <button
                            onClick={(e) => toggleSource(src, e)}
                            title={src.is_active ? 'Đang bật — click để tắt' : 'Đang tắt — click để bật'}
                            className={`relative inline-flex w-8 h-4 rounded-full transition-colors ${
                              src.is_active ? 'bg-emerald-500' : 'bg-gray-600'
                            }`}
                          >
                            <span className={`absolute top-0.5 h-3 w-3 bg-white rounded-full shadow transition-transform ${
                              src.is_active ? 'translate-x-4' : 'translate-x-0.5'
                            }`} />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={(e) => deleteSource(src, e)}
                            className="opacity-0 group-hover:opacity-100 btn-icon text-red-400 p-0.5"
                            title="Xóa nhóm"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Column 2: Docs in selected source ── */}
            {selectedSource ? (
              <div className="w-56 flex-shrink-0 glass-card p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between px-1 mb-1">
                  <div className="flex-1 min-w-0 pr-1">
                    <p className="font-semibold text-xs text-primary truncate">{selectedSource.name}</p>
                    <p className="text-[10px] text-secondary mt-0.5">
                      {selectedSource.is_active
                        ? <span className="text-emerald-400">● Đang kích hoạt</span>
                        : <span className="text-gray-500">● Đã tắt</span>
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => { setShowCrawlForm(true); setShowAddForm(false); setSelectedDoc(null); setEditMode(false); setCrawlResult(null) }}
                      className="btn-icon text-cyan-400 p-1" title="Crawl từ URL"
                    >
                      <Globe size={13} />
                    </button>
                    <button
                      onClick={() => { setShowAddForm(true); setShowCrawlForm(false); setSelectedDoc(null); setEditMode(false) }}
                      className="btn-icon text-brand-400 p-1" title="Thêm tài liệu"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                {sourceDocLoading ? (
                  <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-brand-400" /></div>
                ) : sourceDocs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 text-secondary">
                    <BookOpen size={24} className="opacity-20" />
                    <p className="text-[11px] text-center">Chưa có tài liệu<br/>trong nhóm này</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
                    {sourceDocs.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => openDoc(d)}
                        className={`w-full text-left p-2 rounded-xl transition-all flex items-start gap-1.5 group ${
                          selectedDoc?.id === d.id
                            ? 'bg-brand-500/20 text-brand-200'
                            : 'hover:bg-white/5 text-primary'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] leading-snug truncate">{d.title}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}>
                              {d.category}
                            </span>
                            {d.is_embedded
                              ? <span className="text-[9px] text-green-400">✓</span>
                              : <span className="text-[9px] text-yellow-400">⏳</span>
                            }
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteDoc(d.id) }}
                          className="opacity-0 group-hover:opacity-100 btn-icon text-red-400 p-0.5 flex-shrink-0"
                        >
                          <Trash2 size={10} />
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-56 flex-shrink-0 glass-card p-3 flex flex-col items-center justify-center gap-2 text-secondary">
                <ChevronRight size={24} className="opacity-20" />
                <p className="text-xs text-center">Chọn nhóm nguồn<br/>để xem tài liệu</p>
              </div>
            )}

            {/* ── Column 3: Detail / Edit / Add / Crawl ── */}
            <div className="flex-1 glass-card p-5 flex flex-col min-w-0">

              {/* CRAWL FORM */}
              {showCrawlForm && (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Globe size={16} className="text-cyan-400" />
                      <h3 className="font-semibold text-sm text-primary">
                        Crawl dữ liệu → {selectedSource?.name}
                      </h3>
                    </div>
                    <button onClick={() => setShowCrawlForm(false)} className="btn-icon text-secondary"><X size={14} /></button>
                  </div>

                  {crawlResult ? (
                    <div className="flex flex-col gap-4">
                      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                        <CheckCircle size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-primary">Crawl hoàn tất!</p>
                          <p className="text-xs text-secondary mt-1">
                            Đã thêm <span className="text-emerald-400 font-semibold">{crawlResult.added}</span> trang vào nhóm <b className="text-primary">{selectedSource?.name}</b>.
                          </p>
                        </div>
                      </div>
                      <div className="overflow-y-auto space-y-1.5" style={{ maxHeight: '280px' }}>
                        {crawlResult.docs?.map((d) => (
                          <div key={d.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                            <Globe size={11} className="text-cyan-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-primary truncate">{d.title}</p>
                              <p className="text-[10px] text-secondary truncate">{d.url}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => { setCrawlResult(null); setCrawlForm({ url: '', category: 'other', max_pages: 30, max_depth: 2 }) }}
                        className="btn-primary flex items-center justify-center gap-2 text-sm"
                      >
                        <Globe size={14} /> Crawl URL khác
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 flex-1">
                      <div className="rounded-xl p-3 text-xs text-secondary leading-relaxed" style={{ background: 'var(--bg-secondary)' }}>
                        Nhập địa chỉ website — hệ thống sẽ tự động đọc toàn bộ trang và lưu vào nhóm <b className="text-primary">{selectedSource?.name}</b>.
                      </div>
                      <div>
                        <label className="text-xs text-secondary block mb-1">URL nguồn</label>
                        <input className="input-base" type="url" placeholder="https://example.com"
                          value={crawlForm.url} onChange={(e) => setCrawlForm((p) => ({ ...p, url: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-secondary block mb-1">Danh mục</label>
                        <select className="input-base" value={crawlForm.category}
                          onChange={(e) => setCrawlForm((p) => ({ ...p, category: e.target.value }))}>
                          <option value="brand_voice">Giọng nói thương hiệu</option>
                          <option value="product">Sản phẩm / Dịch vụ</option>
                          <option value="regulation">Quy định nội dung</option>
                          <option value="competitor">Phân tích đối thủ</option>
                          <option value="other">Khác</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-secondary block mb-1">Số trang tối đa</label>
                          <select className="input-base" value={crawlForm.max_pages}
                            onChange={(e) => setCrawlForm((p) => ({ ...p, max_pages: Number(e.target.value) }))}>
                            <option value={10}>10 trang</option>
                            <option value={20}>20 trang</option>
                            <option value={30}>30 trang</option>
                            <option value={50}>50 trang</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-secondary block mb-1">Độ sâu crawl</label>
                          <select className="input-base" value={crawlForm.max_depth}
                            onChange={(e) => setCrawlForm((p) => ({ ...p, max_depth: Number(e.target.value) }))}>
                            <option value={1}>1 cấp</option>
                            <option value={2}>2 cấp</option>
                            <option value={3}>3 cấp</option>
                          </select>
                        </div>
                      </div>
                      <button onClick={crawlUrl} disabled={crawling || !crawlForm.url.trim()}
                        className="btn-primary flex items-center justify-center gap-2 mt-auto">
                        {crawling
                          ? <><Loader2 size={14} className="animate-spin" /> Đang crawl... (có thể mất vài phút)</>
                          : <><Globe size={14} /> Bắt đầu Crawl</>
                        }
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ADD DOC FORM */}
              {showAddForm && (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-sm text-primary">Thêm tài liệu → {selectedSource?.name}</h3>
                    <button onClick={() => setShowAddForm(false)} className="btn-icon text-secondary"><X size={14} /></button>
                  </div>
                  <form onSubmit={addDoc} className="flex flex-col gap-3 flex-1 min-h-0">
                    <div>
                      <label className="text-xs text-secondary block mb-1">Tiêu đề</label>
                      <input className="input-base" placeholder="VD: Dịch vụ ISO 9001 UDA" value={newDoc.title}
                        onChange={(e) => setNewDoc((p) => ({ ...p, title: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-secondary block mb-1">Danh mục</label>
                      <select className="input-base" value={newDoc.category}
                        onChange={(e) => setNewDoc((p) => ({ ...p, category: e.target.value }))}>
                        <option value="brand_voice">Giọng nói thương hiệu</option>
                        <option value="product">Sản phẩm / Dịch vụ</option>
                        <option value="regulation">Quy định nội dung</option>
                        <option value="competitor">Phân tích đối thủ</option>
                        <option value="other">Khác</option>
                      </select>
                    </div>
                    <div className="flex flex-col flex-1 min-h-0">
                      <label className="text-xs text-secondary block mb-1">Nội dung</label>
                      <textarea className="input-base flex-1 min-h-0" style={{ resize: 'none' }}
                        placeholder="Nhập thông tin..."
                        value={newDoc.content} onChange={(e) => setNewDoc((p) => ({ ...p, content: e.target.value }))} />
                    </div>
                    <button type="submit" disabled={submitting || !newDoc.content.trim()}
                      className="btn-primary flex items-center justify-center gap-2 flex-shrink-0">
                      {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Thêm & Nhúng vào Vector DB
                    </button>
                  </form>
                </div>
              )}

              {/* DOCUMENT DETAIL / EDIT */}
              {!showAddForm && !showCrawlForm && selectedDoc && (
                <div className="flex flex-col h-full">
                  <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                    {editMode ? (
                      <>
                        <input className="input-base flex-1 text-sm font-semibold" value={editDraft.title}
                          onChange={(e) => setEditDraft((p) => ({ ...p, title: e.target.value }))} />
                        <select className="input-base w-44 text-xs" value={editDraft.category}
                          onChange={(e) => setEditDraft((p) => ({ ...p, category: e.target.value }))}>
                          <option value="brand_voice">Giọng nói thương hiệu</option>
                          <option value="product">Sản phẩm / Dịch vụ</option>
                          <option value="regulation">Quy định nội dung</option>
                          <option value="competitor">Phân tích đối thủ</option>
                          <option value="other">Khác</option>
                        </select>
                      </>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-primary truncate">{selectedDoc.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}>
                            {selectedDoc.category}
                          </span>
                          {selectedDoc.is_embedded
                            ? <span className="text-[11px] text-green-400">✓ Đã nhúng vào Vector DB</span>
                            : <span className="text-[11px] text-yellow-400">⏳ Chưa nhúng</span>
                          }
                          <span className="text-[11px] text-secondary">{formatDate(selectedDoc.created_at)}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {editMode ? (
                        <>
                          <button onClick={() => setEditMode(false)} className="btn-icon text-secondary" title="Hủy"><X size={14} /></button>
                          <button onClick={saveEdit} disabled={submitting}
                            className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1">
                            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Lưu
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={startEdit} className="btn-icon text-brand-400" title="Sửa"><Pencil size={14} /></button>
                          <button onClick={() => deleteDoc(selectedDoc.id)} className="btn-icon text-red-400 hover:text-red-300" title="Xóa"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {docLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                      <Loader2 size={20} className="animate-spin text-brand-400" />
                    </div>
                  ) : editMode ? (
                    <textarea className="input-base flex-1 min-h-0 text-sm leading-relaxed"
                      style={{ resize: 'none', fontFamily: 'inherit' }}
                      value={editDraft.content}
                      onChange={(e) => setEditDraft((p) => ({ ...p, content: e.target.value }))} />
                  ) : (
                    <div className="flex-1 overflow-y-auto rounded-xl p-4 text-sm text-secondary leading-relaxed whitespace-pre-wrap"
                      style={{ background: 'var(--bg-secondary)', fontFamily: 'inherit' }}>
                      {selectedDoc.content || <span className="italic opacity-50">Không có nội dung</span>}
                    </div>
                  )}
                </div>
              )}

              {/* EMPTY STATE */}
              {!showAddForm && !showCrawlForm && !selectedDoc && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-secondary">
                  <BookOpen size={40} className="opacity-20" />
                  {selectedSource ? (
                    <>
                      <p className="text-sm">Chọn tài liệu hoặc thêm mới</p>
                      <div className="flex gap-2">
                        <button onClick={() => setShowAddForm(true)}
                          className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
                          <Plus size={14} /> Thêm tài liệu
                        </button>
                        <button onClick={() => { setShowCrawlForm(true); setCrawlResult(null) }}
                          className="flex items-center gap-2 text-sm px-3 py-2 text-cyan-400 border border-cyan-400/30 rounded-xl hover:bg-cyan-400/10">
                          <Globe size={14} /> Crawl URL
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm">Chọn một nhóm nguồn bên trái</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
