import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sparkles, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MessageBubble({ message, isStreaming }) {
  const isAI = message.role === 'assistant'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-3', isAI ? 'items-start' : 'items-start flex-row-reverse')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md',
          isAI
            ? 'bg-gradient-to-br from-violet-500 to-purple-700'
            : 'bg-gradient-to-br from-pink-500 to-rose-600'
        )}
      >
        {isAI ? <Sparkles size={14} className="text-white" /> : <User size={14} className="text-white" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isAI
            ? 'rounded-tl-sm'
            : 'rounded-tr-sm text-right'
        )}
        style={
          isAI
            ? { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }
            : { background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff' }
        }
      >
        {isAI ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || ''}
            </ReactMarkdown>
            {isStreaming && message.content === '' && (
              <span className="flex gap-1 mt-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            )}
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    </motion.div>
  )
}
