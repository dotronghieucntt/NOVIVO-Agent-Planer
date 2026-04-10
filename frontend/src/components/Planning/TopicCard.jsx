import { motion } from 'framer-motion'
import { Clock, Tag, ChevronRight, Sparkles, BookOpen } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'

export default function TopicCard({ topic, index, onSelect, selected }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      onClick={() => onSelect(topic)}
      className={cn(
        'glass-card p-5 cursor-pointer transition-all duration-200 select-none group',
        selected
          ? 'border-brand-500/60 shadow-lg shadow-brand-600/10'
          : 'hover:border-brand-500/30'
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: `hsl(${260 + index * 30}, 70%, 55%)` }}
          >
            {index + 1}
          </div>
          <h3 className="font-semibold text-sm text-primary leading-snug group-hover:text-brand-300 transition-colors">
            {topic.title}
          </h3>
        </div>
        <ChevronRight
          size={16}
          className="text-secondary flex-shrink-0 group-hover:text-brand-400 transition-colors"
        />
      </div>

      {/* Angle */}
      {topic.angle && (
        <p className="text-xs text-secondary mb-3">
          <span className="text-brand-400 font-medium">Góc tiếp cận: </span>
          {topic.angle}
        </p>
      )}

      {/* Hook */}
      {topic.hook && (
        <div
          className="rounded-lg px-3 py-2 mb-3 text-xs italic"
          style={{ background: 'rgba(139,92,246,0.08)', borderLeft: '2px solid #8b5cf6' }}
        >
          <span className="text-secondary">Hook: </span>
          <span className="text-primary">{topic.hook}</span>
        </div>
      )}

      {/* Knowledge source */}
      {topic.knowledge_source && topic.knowledge_source !== 'Giáo dục ISO chung' && (
        <div className="flex items-start gap-1.5 mb-3 text-[11px] text-secondary">
          <BookOpen size={10} className="mt-0.5 flex-shrink-0 text-brand-400" />
          <span className="italic opacity-80">{topic.knowledge_source}</span>
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center gap-3 flex-wrap">
        {topic.estimated_duration && (
          <span className="flex items-center gap-1 text-[11px] text-secondary">
            <Clock size={11} />
            {formatDuration(topic.estimated_duration)}
          </span>
        )}
        {topic.tags?.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(139,92,246,0.12)', color: '#c4b5fd' }}
          >
            <Tag size={9} />
            {tag}
          </span>
        ))}
      </div>

      {selected && (
        <div className="mt-3 pt-3 border-t flex items-center gap-2 text-xs text-brand-300" style={{ borderColor: 'var(--border)' }}>
          <Sparkles size={12} />
          <span>Đang tạo kịch bản chi tiết...</span>
        </div>
      )}
    </motion.div>
  )
}
