import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trash2, Clock, Tag, X, FileText, Hash, Loader2, Mic, Eye, Wand2, Music, Copy, ClipboardList } from 'lucide-react'
import { cn, formatDate, formatDuration, STATUS_COLORS } from '@/lib/utils'
import { contentApi } from '@/lib/api'
import toast from 'react-hot-toast'

function useCopy() {
  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Đã copy!')).catch(() => toast.error('Copy thất bại'))
  }
  return copy
}

function CopyBtn({ text, className = '' }) {
  const copy = useCopy()
  return (
    <button
      onClick={e => { e.stopPropagation(); copy(text) }}
      className={cn('btn-icon text-secondary hover:text-brand-300 flex-shrink-0', className)}
      title="Copy"
    >
      <Copy size={11} />
    </button>
  )
}

function buildFullText(data) {
  const lines = []
  lines.push(`=== ${data.title} ===`)
  if (data.topic && data.topic !== data.title) lines.push(`Góc: ${data.topic}`)
  if (data.channel) lines.push(`Kênh: ${data.channel}`)
  if (data.duration_seconds) lines.push(`Thời lượng: ${data.duration_seconds}s`)
  if (data.tags?.length) lines.push(`Hashtag: ${data.tags.join(' ')}`)
  lines.push('')

  const sd = data.script_data || {}
  if (sd.hook) {
    lines.push('⚡ HOOK MỞ ĐẦU')
    lines.push(sd.hook)
    lines.push('')
  }

  if (sd.segments?.length) {
    lines.push('📋 PHÂN ĐOẠN NỘI DUNG')
    sd.segments.forEach((seg, i) => {
      lines.push(`\n[Đoạn ${seg.segment_number ?? i + 1}${seg.duration ? ` - ${seg.duration}s` : ''}${seg.transition ? ` - ${seg.transition}` : ''}]`)
      if (seg.voiceover) lines.push(`🎙 Lời thoại: ${seg.voiceover}`)
      if (seg.on_screen_text) lines.push(`📄 Text màn hình: ${seg.on_screen_text}`)
      if (seg.visual_prompt) lines.push(`✨ Visual prompt: ${seg.visual_prompt}`)
    })
    lines.push('')
  }

  if (sd.background_music) lines.push(`🎵 Nhạc nền: ${sd.background_music}`)
  if (sd.ai_tools) lines.push(`🤖 Công cụ AI: ${sd.ai_tools}`)
  if (sd.caption) { lines.push(''); lines.push(`📝 Caption: ${sd.caption}`) }

  return lines.join('\n')
}

function ScriptDetailModal({ scriptId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const copy = useCopy()

  useEffect(() => {
    contentApi.getScript(scriptId)
      .then(r => setData(r.data))
      .catch(() => toast.error('Không thể tải kịch bản'))
      .finally(() => setLoading(false))
  }, [scriptId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18 }}
        className="glass-card w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-brand-400" />
            <span className="font-semibold text-primary text-sm">Chi tiết kịch bản</span>
          </div>
          <div className="flex items-center gap-1">
            {data && (
              <button
                onClick={() => copy(buildFullText(data))}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium text-brand-300 hover:text-brand-200 hover:bg-brand-600/15 transition-colors"
                title="Copy toàn bộ kịch bản"
              >
                <ClipboardList size={13} />
                Copy All
              </button>
            )}
            <button onClick={onClose} className="btn-icon text-secondary hover:text-primary">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-secondary">
              <Loader2 size={18} className="animate-spin text-brand-400" />
              <span className="text-sm">Đang tải...</span>
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* Title & meta */}
              <div>
                <h2 className="text-base font-bold text-primary mb-1">{data.title}</h2>
                {data.topic && data.topic !== data.title && (
                  <p className="text-xs text-secondary">{data.topic}</p>
                )}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {data.status && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}>
                      {data.status}
                    </span>
                  )}
                  {data.channel && (
                    <span className="text-xs text-secondary flex items-center gap-1">
                      <Tag size={10} /> {data.channel}
                    </span>
                  )}
                  {data.duration_seconds && (
                    <span className="text-xs text-secondary flex items-center gap-1">
                      <Clock size={10} /> {formatDuration(data.duration_seconds)}
                    </span>
                  )}
                  <span className="text-xs text-secondary">{formatDate(data.created_at)}</span>
                </div>
              </div>

              {/* Tags */}
              {data.tags?.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {data.tags.map(t => (
                    <span key={t} className="text-xs px-2 py-0.5 rounded-md flex items-center gap-1"
                      style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd' }}>
                      <Hash size={9} />{t.replace(/^#/, '')}
                    </span>
                  ))}
                  <CopyBtn text={data.tags.join(' ')} />
                </div>
              )}

              {/* Hook */}
              {data.script_data?.hook && (
                <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-yellow-400 uppercase tracking-wide">⚡ Hook mở đầu</p>
                    <CopyBtn text={data.script_data.hook} />
                  </div>
                  <p className="text-primary leading-relaxed">{data.script_data.hook}</p>
                </div>
              )}

              {/* Segments */}
              {data.script_data?.segments?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">Phân đoạn nội dung</p>
                  <div className="space-y-2">
                    {data.script_data.segments.map((seg, i) => (
                      <div key={i} className="rounded-xl p-3 text-xs space-y-2"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center flex-shrink-0 font-bold"
                            style={{ background: 'rgba(139,92,246,0.25)', color: '#c4b5fd' }}>
                            {seg.segment_number ?? i + 1}
                          </span>
                          {seg.duration && <span className="text-secondary ml-auto">{seg.duration}s</span>}
                          {seg.transition && <span className="text-secondary opacity-60">{seg.transition}</span>}
                        </div>
                        {seg.voiceover && (
                          <div className="flex gap-2 items-start">
                            <Mic size={11} className="text-brand-400 flex-shrink-0 mt-0.5" />
                            <p className="text-primary leading-relaxed flex-1">{seg.voiceover}</p>
                            <CopyBtn text={seg.voiceover} />
                          </div>
                        )}
                        {seg.on_screen_text && (
                          <div className="flex gap-2 items-start">
                            <FileText size={11} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                            <p className="text-emerald-300 leading-relaxed flex-1">{seg.on_screen_text}</p>
                            <CopyBtn text={seg.on_screen_text} />
                          </div>
                        )}
                        {seg.visual_prompt && (
                          <div className="flex gap-2 items-start">
                            <Wand2 size={11} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                            <p className="text-yellow-200/70 leading-relaxed italic flex-1">{seg.visual_prompt}</p>
                            <CopyBtn text={seg.visual_prompt} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Music & AI tools */}
              {data.script_data?.background_music && (
                <div className="flex gap-2 items-start">
                  <Music size={12} className="text-brand-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-secondary uppercase tracking-wide mb-0.5">Nhạc nền</p>
                    <p className="text-xs text-primary">{data.script_data.background_music}</p>
                  </div>
                  <CopyBtn text={data.script_data.background_music} />
                </div>
              )}
              {data.script_data?.ai_tools && (
                <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold text-brand-300 uppercase tracking-wide">🤖 Công cụ AI gợi ý</p>
                    <CopyBtn text={data.script_data.ai_tools} />
                  </div>
                  <p className="text-secondary">{data.script_data.ai_tools}</p>
                </div>
              )}

              {/* Raw fallback */}
              {!data.script_data?.scenes?.length && data.raw_script && (
                <div>
                  <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">Nội dung kịch bản</p>
                  <pre className="text-xs text-primary whitespace-pre-wrap leading-relaxed p-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                    {data.raw_script}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-secondary text-center py-12">Không có dữ liệu</p>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default function KanbanCard({ card, isDragging, onRefresh }) {
  const [deleting, setDeleting] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirm('Xóa kịch bản này?')) return
    setDeleting(true)
    try {
      await contentApi.deleteScript(card.id)
      toast.success('Đã xóa')
      onRefresh()
    } catch {
      toast.error('Không thể xóa')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -1 }}
        onClick={() => setShowDetail(true)}
        className={cn(
          'glass-card p-3.5 group transition-all duration-150 cursor-pointer',
          isDragging && 'shadow-xl shadow-brand-600/20 scale-[1.02] rotate-1'
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-semibold text-primary leading-snug line-clamp-2 flex-1">
            {card.title}
          </p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="opacity-0 group-hover:opacity-100 transition-opacity btn-icon text-red-400 hover:text-red-300 flex-shrink-0"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {card.topic && card.topic !== card.title && (
          <p className="text-xs text-secondary line-clamp-1 mb-2">{card.topic}</p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {card.channel && (
            <span className="text-[11px] text-secondary flex items-center gap-1">
              <Tag size={9} />
              {card.channel}
            </span>
          )}
          {card.duration_seconds && (
            <span className="text-[11px] text-secondary flex items-center gap-1">
              <Clock size={9} />
              {formatDuration(card.duration_seconds)}
            </span>
          )}
        </div>

        {card.tags?.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-2">
            {card.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0.5 rounded-md"
                style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd' }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-secondary mt-2">{formatDate(card.created_at)}</p>
      </motion.div>

      <AnimatePresence>
        {showDetail && (
          <ScriptDetailModal scriptId={card.id} onClose={() => setShowDetail(false)} />
        )}
      </AnimatePresence>
    </>
  )
}

