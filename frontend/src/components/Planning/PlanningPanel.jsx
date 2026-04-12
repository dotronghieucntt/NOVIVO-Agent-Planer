import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarPlus, Loader2, RefreshCw, FileText, Music, Hash,
  Mic, Wand2, Eye, Zap, Bot, Plus, Trash2, Pencil, Check,
  X, ChevronDown, Filter, Sparkles, BookOpen, Clock, Tag,
  MoreHorizontal, ArrowRight, Copy, RotateCcw,
} from 'lucide-react'
import { planningApi } from '@/lib/api'
import { useSettings } from '@/components/Layout/RightPanel'
import { cn, formatDate, formatTime, KANBAN_STATUSES, STATUS_COLORS } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status, onChange }) {
  const [open, setOpen] = useState(false)
  const color = STATUS_COLORS[status] || 'bg-zinc-500/15 text-zinc-300 border-zinc-500/20'
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer transition-opacity hover:opacity-80', color)}
      >
        {status}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-7 z-50 glass-card shadow-xl min-w-[140px] py-1 rounded-xl border"
            style={{ borderColor: 'var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            {KANBAN_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false) }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs transition-colors',
                  s === status ? 'text-brand-300 font-semibold' : 'text-secondary hover:text-primary'
                )}
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Inline edit field ─────────────────────────────────────────────────────
function EditableField({ value, placeholder, onSave, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const commit = () => {
    if (draft.trim() && draft !== value) onSave(draft.trim())
    setEditing(false)
  }
  return editing ? (
    <div className="flex items-center gap-1.5 w-full">
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        onBlur={commit}
        className={cn('flex-1 bg-transparent border-b outline-none text-primary pb-0.5', className)}
        style={{ borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}
      />
      <button onClick={commit} className="text-green-400 hover:text-green-300"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="text-secondary hover:text-primary"><X size={12} /></button>
    </div>
  ) : (
    <span
      className={cn('cursor-text hover:underline decoration-dashed underline-offset-2', className, !value && 'italic text-secondary opacity-60')}
      onDoubleClick={e => { e.stopPropagation(); setEditing(true); setDraft(value || '') }}
      title="Double-click để sửa"
    >
      {value || placeholder}
    </span>
  )
}

// ─── AI-generated topic card (from bulk generate) ─────────────────────────
function AiTopicCard({ topic, index, onSelect, onSaveAsIdea, selected }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      onClick={() => !selected && onSelect(topic)}
      className={cn(
        'glass-card p-4 group transition-all duration-200 select-none cursor-pointer',
        selected ? 'border-brand-500/60 shadow-lg shadow-brand-600/10' : 'hover:border-brand-500/30'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: `hsl(${260 + index * 30}, 70%, 55%)` }}
          >
            {index + 1}
          </div>
          <h3 className="font-semibold text-sm text-primary leading-snug">{topic.title}</h3>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(topic) }}
            className="btn-icon text-purple-400 hover:text-purple-300"
            title="Tạo kịch bản ngay"
          >
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {topic.angle && (
        <p className="text-xs text-secondary mb-2">
          <span className="text-brand-400 font-medium">Góc: </span>{topic.angle}
        </p>
      )}
      {topic.hook && (
        <div className="rounded-lg px-3 py-1.5 mb-2 text-xs italic" style={{ background: 'rgba(139,92,246,0.08)', borderLeft: '2px solid #8b5cf6' }}>
          {topic.hook}
        </div>
      )}
      {topic.knowledge_source && topic.knowledge_source !== 'Giáo dục ISO chung' && (
        <p className="text-[10px] text-secondary flex items-center gap-1 mb-2 opacity-70">
          <BookOpen size={9} className="text-brand-400" />
          {topic.knowledge_source}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {topic.estimated_duration && (
          <span className="flex items-center gap-1 text-[10px] text-secondary">
            <Clock size={9} />{topic.estimated_duration}s
          </span>
        )}
        {topic.tags?.slice(0, 3).map(t => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd' }}>{t}</span>
        ))}
      </div>

      {selected && (
        <div className="mt-2 pt-2 border-t flex items-center gap-1.5 text-xs text-brand-300" style={{ borderColor: 'var(--border)' }}>
          <Loader2 size={11} className="animate-spin" /> Đang tạo kịch bản...
        </div>
      )}
    </motion.div>
  )
}

// ─── Saved idea row ────────────────────────────────────────────────────────
function IdeaRow({ idea, onUpdate, onDelete, onGenScript }) {
  const [loadingScript, setLoadingScript] = useState(false)
  const { duration, aiStyle, voiceTone, channel: defaultChannel } = useSettings()

  const handleGenScript = async () => {
    setLoadingScript(true)
    try {
      await onGenScript(idea)
    } finally {
      setLoadingScript(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="glass-card px-4 py-3 group"
    >
      <div className="flex items-start gap-3">
        {/* Status badge */}
        <div className="pt-0.5 flex-shrink-0">
          <StatusBadge status={idea.status} onChange={(s) => onUpdate(idea.id, { status: s })} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <EditableField
            value={idea.topic}
            placeholder="Tiêu đề ý tưởng..."
            onSave={(v) => onUpdate(idea.id, { topic: v })}
            className="text-sm font-semibold"
          />
          <EditableField
            value={idea.angle}
            placeholder="Góc tiếp cận (double-click để thêm)..."
            onSave={(v) => onUpdate(idea.id, { angle: v })}
            className="text-xs text-secondary"
          />
          <div className="flex items-center gap-3 pt-0.5">
            {idea.channel && (
              <span className="text-[10px] text-secondary flex items-center gap-1">
                <Tag size={9} />{idea.channel}
              </span>
            )}
            <span className="text-[10px] text-secondary flex items-center gap-1">
              <Clock size={9} />{formatTime(idea.created_at)} {formatDate(idea.created_at)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={handleGenScript}
            disabled={loadingScript}
            className="btn-icon text-purple-400 hover:text-purple-300"
            title="Tạo kịch bản từ ý tưởng này"
          >
            {loadingScript ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          </button>
          <button
            onClick={() => onDelete(idea.id)}
            className="btn-icon text-red-400 hover:text-red-300"
            title="Xóa"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Script output panel ──────────────────────────────────────────────────
function ScriptPanel({ script, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="glass-card p-5 space-y-4"
    >
      <div className="flex items-center gap-3">
        <FileText size={16} className="text-brand-400" />
        <h3 className="font-bold text-sm text-primary flex-1">{script.title || 'Kịch bản'}</h3>
        {script.total_duration && <span className="text-xs text-secondary">{script.total_duration}s</span>}
        <button onClick={onClose} className="btn-icon text-secondary hover:text-primary"><X size={14} /></button>
      </div>

      {script.hook && (
        <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <p className="text-xs font-semibold text-yellow-300 mb-1 flex items-center gap-1.5"><Zap size={11} /> Hook (3 giây đầu)</p>
          <p className="text-sm text-primary italic">"{script.hook}"</p>
        </div>
      )}

      {script.segments?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-secondary uppercase tracking-wide">{script.segments.length} phân đoạn</p>
          {script.segments.map((seg, i) => (
            <div key={i} className="rounded-xl p-3.5 space-y-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' }}>Đoạn {seg.segment_number}</span>
                <span className="ml-auto text-xs text-secondary">{seg.duration}s</span>
              </div>
              {seg.voiceover && <p className="text-sm"><span className="text-brand-400 text-xs flex items-center gap-1 mb-0.5"><Mic size={10} /> Lời thoại AI</span><span className="text-primary">"{seg.voiceover}"</span></p>}
              {seg.on_screen_text && <p className="text-sm"><span className="text-emerald-400 text-xs flex items-center gap-1 mb-0.5"><Eye size={10} /> Text màn hình</span><span className="text-emerald-200">{seg.on_screen_text}</span></p>}
              {seg.visual_prompt && <p className="text-xs italic text-yellow-200/70 flex items-start gap-1"><Wand2 size={10} className="mt-0.5 flex-shrink-0 text-yellow-400" />{seg.visual_prompt}</p>}
              {seg.transition && <p className="text-[10px] text-secondary">Chuyển cảnh: {seg.transition}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {script.background_music && (
          <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
            <p className="text-xs text-secondary mb-1 flex items-center gap-1.5"><Music size={11} /> Nhạc nền</p>
            <p className="text-sm text-primary">{script.background_music}</p>
          </div>
        )}
        {script.hashtags?.length > 0 && (
          <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)' }}>
            <p className="text-xs text-secondary mb-1 flex items-center gap-1.5"><Hash size={11} /> Hashtags</p>
            <div className="flex flex-wrap gap-1">{script.hashtags.map(h => <span key={h} className="text-xs text-brand-300">{h}</span>)}</div>
          </div>
        )}
      </div>

      {script.ai_tools && (
        <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <p className="font-semibold text-purple-300 mb-1 flex items-center gap-1.5"><Bot size={11} /> Công cụ AI gợi ý</p>
          <p className="text-secondary">{script.ai_tools}</p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Add idea form ─────────────────────────────────────────────────────────
function AddIdeaForm({ onAdd, onClose, defaultChannel }) {
  const [topic, setTopic] = useState('')
  const [angle, setAngle] = useState('')
  const [channel, setChannel] = useState(defaultChannel || 'TikTok chung')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!topic.trim()) return
    setLoading(true)
    try {
      await onAdd({ topic: topic.trim(), angle: angle.trim(), channel })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="glass-card p-4 space-y-3 border-brand-500/30"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-brand-300 uppercase tracking-wide">Thêm ý tưởng thủ công</p>
        <button onClick={onClose} className="btn-icon text-secondary"><X size={14} /></button>
      </div>
      <input
        autoFocus
        value={topic}
        onChange={e => setTopic(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Tiêu đề / chủ đề video..."
        className="input-base text-sm"
      />
      <input
        value={angle}
        onChange={e => setAngle(e.target.value)}
        placeholder="Góc tiếp cận (tùy chọn)..."
        className="input-base text-sm"
      />
      <input
        value={channel}
        onChange={e => setChannel(e.target.value)}
        placeholder="Kênh..."
        className="input-base text-sm"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="btn-ghost text-xs">Hủy</button>
        <button onClick={submit} disabled={!topic.trim() || loading} className="btn-primary text-xs flex items-center gap-1.5">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Thêm
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────
export default function PlanningPanel() {
  const { numTopics, channel, duration, voiceTone, aiStyle } = useSettings()

  // AI-suggested topics (not yet saved)
  const [aiTopics, setAiTopics] = useState([])
  const [loadingTopics, setLoadingTopics] = useState(false)

  // Saved ideas from DB
  const [ideas, setIdeas] = useState([])
  const [loadingIdeas, setLoadingIdeas] = useState(true)

  // Script state
  const [script, setScript] = useState(null)
  const [loadingScript, setLoadingScript] = useState(false)
  const [scriptingFor, setScriptingFor] = useState(null)

  // UI state
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAiSection, setShowAiSection] = useState(true)

  // Load saved ideas
  const loadIdeas = useCallback(async () => {
    setLoadingIdeas(true)
    try {
      const res = await planningApi.listIdeas({ limit: 100 })
      setIdeas(res.data.items || [])
    } catch {
      // silent
    } finally {
      setLoadingIdeas(false)
    }
  }, [])

  useEffect(() => { loadIdeas() }, [loadIdeas])

  // Generate AI topics
  const handleGenerate = async () => {
    setLoadingTopics(true)
    setAiTopics([])
    setScript(null)
    setShowAiSection(true)
    try {
      const res = await planningApi.generateTopics({
        channel,
        num_topics: numTopics,
        extra_context: `${voiceTone} | ${aiStyle}`,
      })
      const topics = res.data.topics || []
      setAiTopics(topics)

      // Auto-save tất cả ý tưởng vào DB ngay sau khi tạo
      const saved = []
      for (const t of topics) {
        try {
          const r = await planningApi.createIdea({
            topic: t.title,
            angle: t.angle || '',
            channel,
          })
          saved.push(r.data)
        } catch {
          // bỏ qua nếu lưu 1 topic thất bại
        }
      }
      if (saved.length > 0) {
        setIdeas(prev => [...saved, ...prev])
        toast.success(`Đã lưu ${saved.length} ý tưởng vào danh sách!`)
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Không thể tạo chủ đề. Kiểm tra API key.'
      toast.error(msg)
    } finally {
      setLoadingTopics(false)
    }
  }

  // Save AI topic as idea
  const handleSaveAsIdea = async (topic) => {
    try {
      const res = await planningApi.createIdea({
        topic: topic.title,
        angle: topic.angle || '',
        channel,
      })
      setIdeas(prev => [res.data, ...prev])
      toast.success('Đã lưu ý tưởng!')
    } catch {
      toast.error('Không thể lưu ý tưởng')
    }
  }

  // Manually add idea
  const handleAddIdea = async (data) => {
    const res = await planningApi.createIdea(data)
    setIdeas(prev => [res.data, ...prev])
    toast.success('Đã thêm ý tưởng!')
  }

  // Update idea
  const handleUpdateIdea = async (id, data) => {
    try {
      const res = await planningApi.updateIdea(id, data)
      setIdeas(prev => prev.map(i => i.id === id ? res.data : i))
    } catch {
      toast.error('Không thể cập nhật')
    }
  }

  // Delete idea
  const handleDeleteIdea = async (id) => {
    if (!confirm('Xóa ý tưởng này?')) return
    try {
      await planningApi.deleteIdea(id)
      setIdeas(prev => prev.filter(i => i.id !== id))
      toast.success('Đã xóa')
    } catch {
      toast.error('Không thể xóa')
    }
  }

  // Generate script from idea or AI topic
  const handleGenScript = async (topic) => {
    setScriptingFor(topic.title || topic.topic)
    setScript(null)
    setLoadingScript(true)
    try {
      const res = await planningApi.createScript({
        topic: topic.title || topic.topic,
        angle: topic.angle || '',
        duration_seconds: duration,
        channel,
        style_notes: `${voiceTone} | Dạng sản xuất: ${aiStyle}`,
        save: true,
      })
      setScript(res.data.script)
      toast.success('Kịch bản đã được lưu vào Kanban!')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Không thể tạo kịch bản.'
      toast.error(msg)
    } finally {
      setLoadingScript(false)
      setScriptingFor(null)
    }
  }

  const filteredIdeas = filterStatus === 'all'
    ? ideas
    : ideas.filter(i => i.status === filterStatus)

  const statusCounts = KANBAN_STATUSES.reduce((acc, s) => {
    acc[s] = ideas.filter(i => i.status === s).length
    return acc
  }, {})

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b flex-shrink-0 space-y-3" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-primary">Lên kế hoạch hôm nay</h2>
            <p className="text-xs text-secondary">
              AI tạo {numTopics} ý tưởng cho kênh <span className="text-brand-300">{channel}</span>
              {' '}— <span className="text-purple-300">{aiStyle}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(v => !v)}
              className="btn-ghost flex items-center gap-1.5 text-sm"
              title="Thêm ý tưởng thủ công"
            >
              <Plus size={14} />
              Thêm
            </button>
            <button
              onClick={handleGenerate}
              disabled={loadingTopics}
              className="btn-primary flex items-center gap-2"
            >
              {loadingTopics ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
              {loadingTopics ? 'Đang tạo...' : 'Tạo ý tưởng'}
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 overflow-x-auto pb-0.5">
          <button
            onClick={() => setFilterStatus('all')}
            className={cn('flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors', filterStatus === 'all' ? 'bg-brand-600/20 text-brand-300' : 'text-secondary hover:text-primary')}
          >
            Tất cả ({ideas.length})
          </button>
          {KANBAN_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn('flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors', filterStatus === s ? 'bg-brand-600/20 text-brand-300' : 'text-secondary hover:text-primary')}
            >
              {s} ({statusCounts[s] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Add form */}
        <AnimatePresence>
          {showAddForm && (
            <AddIdeaForm
              onAdd={handleAddIdea}
              onClose={() => setShowAddForm(false)}
              defaultChannel={channel}
            />
          )}
        </AnimatePresence>

        {/* Script output */}
        <AnimatePresence>
          {loadingScript && !script && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 py-8 text-secondary justify-center">
              <Loader2 size={18} className="animate-spin text-brand-400" />
              <span className="text-sm">Đang viết kịch bản cho "{scriptingFor}"...</span>
            </motion.div>
          )}
          {script && <ScriptPanel script={script} onClose={() => setScript(null)} />}
        </AnimatePresence>

        {/* AI-generated suggestions */}
        <AnimatePresence>
          {(aiTopics.length > 0 || loadingTopics) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setShowAiSection(v => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-primary"
                >
                  <Sparkles size={14} className="text-brand-400" />
                  {loadingTopics ? 'Đang tạo ý tưởng...' : `${aiTopics.length} gợi ý AI mới`}
                  <ChevronDown size={13} className={cn('text-secondary transition-transform', !showAiSection && '-rotate-90')} />
                </button>
                {!loadingTopics && aiTopics.length > 0 && (
                  <div className="flex gap-2">
                    <button onClick={handleGenerate} className="text-[11px] text-secondary hover:text-primary flex items-center gap-1">
                      <RotateCcw size={10} /> Tạo lại
                    </button>
                  </div>
                )}
              </div>

              {showAiSection && (
                <div className="grid grid-cols-1 gap-3">
                  {loadingTopics ? (
                    [1, 2, 3].map(i => (
                      <div key={i} className="glass-card p-4 animate-pulse space-y-2">
                        <div className="h-3 rounded bg-white/5 w-3/4" />
                        <div className="h-2 rounded bg-white/5 w-1/2" />
                        <div className="h-2 rounded bg-white/5 w-2/3" />
                      </div>
                    ))
                  ) : (
                    aiTopics.map((t, i) => (
                      <AiTopicCard
                        key={i}
                        topic={t}
                        index={i}
                        onSelect={handleGenScript}
                        onSaveAsIdea={handleSaveAsIdea}
                        selected={scriptingFor === t.title && loadingScript}
                      />
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved ideas list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-primary">
              {filterStatus === 'all' ? 'Tất cả ý tưởng' : filterStatus}
              <span className="ml-2 text-xs text-secondary font-normal">({filteredIdeas.length})</span>
            </p>
            <button onClick={loadIdeas} className="btn-ghost text-xs flex items-center gap-1 text-secondary">
              <RefreshCw size={11} />
            </button>
          </div>

          {loadingIdeas ? (
            <div className="flex items-center justify-center py-10 gap-2 text-secondary text-sm">
              <Loader2 size={16} className="animate-spin text-brand-400" /> Đang tải...
            </div>
          ) : filteredIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-secondary">
              <div className="w-14 h-14 rounded-2xl bg-brand-600/10 flex items-center justify-center mb-3">
                <CalendarPlus size={24} className="text-brand-400" />
              </div>
              <p className="font-semibold text-primary text-sm mb-1">
                {filterStatus === 'all' ? 'Chưa có ý tưởng nào' : `Không có ý tưởng "${filterStatus}"`}
              </p>
              <p className="text-xs text-center max-w-xs">
                Nhấn <span className="text-brand-300">Tạo ý tưởng</span> để AI gợi ý, hoặc <span className="text-brand-300">Thêm</span> thủ công.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-2">
                {filteredIdeas.map(idea => (
                  <IdeaRow
                    key={idea.id}
                    idea={idea}
                    onUpdate={handleUpdateIdea}
                    onDelete={handleDeleteIdea}
                    onGenScript={handleGenScript}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}
