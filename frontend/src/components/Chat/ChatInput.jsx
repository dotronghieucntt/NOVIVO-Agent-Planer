import { useState, useRef } from 'react'
import { Send, Calendar, PenLine, TrendingUp, BarChart2, Tag, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const SKILL_CATEGORIES = [
  {
    id: 'plan',
    label: 'Lập kế hoạch',
    icon: Calendar,
    color: 'text-blue-400',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.25)',
    prompts: [
      'Lên lịch nội dung 7 ngày cho TikTok chung',
      'Tạo 5 ý tưởng video ISO 9001 cho tuần này',
      'Lên kế hoạch tháng với chủ đề an ninh thông tin (ISO 27001)',
      'Tạo 3 chủ đề mới chưa từng làm về chứng nhận ISO',
    ],
  },
  {
    id: 'script',
    label: 'Viết kịch bản',
    icon: PenLine,
    color: 'text-purple-400',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.25)',
    prompts: [
      'Viết kịch bản POV: doanh nghiệp chưa có ISO 9001',
      'Viết lại kịch bản gần nhất theo style hài hước hơn',
      'Viết kịch bản tutorial 60s về quy trình đăng ký ISO',
      'Viết kịch bản storytelling: hành trình đạt ISO 27001',
    ],
  },
  {
    id: 'trend',
    label: 'Xu hướng',
    icon: TrendingUp,
    color: 'text-orange-400',
    bg: 'rgba(251,146,60,0.12)',
    border: 'rgba(251,146,60,0.25)',
    prompts: [
      'Tìm trend TikTok B2B đang viral nhất tháng 4/2026',
      'Tìm xu hướng content về ISO và chất lượng doanh nghiệp',
      'Tìm trend video giáo dục/kiến thức đang hot trên TikTok',
      'Tìm trend AI video tool đối thủ cạnh tranh B2B đang dùng trên TikTok',
    ],
  },
  {
    id: 'analyze',
    label: 'Phân tích',
    icon: BarChart2,
    color: 'text-green-400',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.25)',
    prompts: [
      'Thống kê tổng quan dự án hiện tại',
      'Tìm khoảng trống nội dung — chủ đề chưa khai thác',
      'Kịch bản nào chưa tạo AI? Liệt kê và sắp xếp ưu tiên',
      'So sánh số lượng nội dung theo từng loại ISO',
    ],
  },
  {
    id: 'hashtag',
    label: 'Hashtag & Hook',
    icon: Tag,
    color: 'text-pink-400',
    bg: 'rgba(236,72,153,0.12)',
    border: 'rgba(236,72,153,0.25)',
    prompts: [
      'Gợi ý 15 hashtag viral cho video về ISO 9001',
      'Viết 5 câu hook 3 giây mạnh cho video chứng nhận',
      'Gợi ý hashtag trending kết hợp B2B + TikTok Vietnam',
      'Viết 3 biến thể hook: sốc, tò mò, đồng cảm cho cùng 1 chủ đề',
    ],
  },
]

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState('')
  const [activeSkill, setActiveSkill] = useState(null)
  const textareaRef = useRef(null)

  const submit = () => {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const selectPrompt = (p) => {
    setValue(p)
    textareaRef.current?.focus()
    setActiveSkill(null)
  }

  const toggleSkill = (id) => {
    setActiveSkill(prev => prev === id ? null : id)
  }

  const activeCategory = SKILL_CATEGORIES.find(c => c.id === activeSkill)

  return (
    <div className="space-y-2">
      {/* Skill tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {SKILL_CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const isActive = activeSkill === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => toggleSkill(cat.id)}
              disabled={disabled}
              className={cn(
                'flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg transition-all font-medium disabled:opacity-40',
                isActive ? cat.color : 'text-secondary hover:text-primary'
              )}
              style={{
                background: isActive ? cat.bg : 'var(--bg-card)',
                border: `1px solid ${isActive ? cat.border : 'var(--border)'}`,
              }}
            >
              <Icon size={11} />
              {cat.label}
              <ChevronDown size={10} className={cn('transition-transform', isActive && 'rotate-180')} />
            </button>
          )
        })}
      </div>

      {/* Prompt suggestions for active skill */}
      {activeCategory && (
        <div className="flex flex-col gap-1 p-2 rounded-xl" style={{ background: activeCategory.bg, border: `1px solid ${activeCategory.border}` }}>
          {activeCategory.prompts.map((p) => (
            <button
              key={p}
              onClick={() => selectPrompt(p)}
              disabled={disabled}
              className="text-left text-xs px-2 py-1.5 rounded-lg transition-all hover:text-primary disabled:opacity-40"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div
        className="flex items-end gap-2 rounded-2xl p-2"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(139,92,246,0.25)' }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
          onKeyDown={handleKeyDown}
          placeholder="Nhắn tin với AI Agent... (Enter để gửi, Shift+Enter xuống dòng)"
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent resize-none text-sm outline-none px-2 py-1.5 disabled:opacity-50"
          style={{ color: 'var(--text-primary)', minHeight: '36px', maxHeight: '120px' }}
        />
        <button
          onClick={submit}
          disabled={!value.trim() || disabled}
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0',
            value.trim() && !disabled
              ? 'bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-lg shadow-violet-600/30 hover:shadow-violet-600/50'
              : 'text-secondary cursor-not-allowed'
          )}
          style={!value.trim() || disabled ? { background: 'var(--bg-secondary)' } : {}}
        >
          <Send size={15} />
        </button>
      </div>

      <p className="text-[11px] text-secondary text-center">
        AI có thể mắc lỗi. Luôn xem xét nội dung trước khi đăng.
      </p>
    </div>
  )
}
