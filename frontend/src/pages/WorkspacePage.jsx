import { useState } from 'react'
import { MessageSquare, LayoutGrid } from 'lucide-react'
import ChatInterface from '@/components/Chat/ChatInterface'
import KanbanBoard from '@/components/Kanban/KanbanBoard'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'chat',   label: 'AI Agent',     icon: MessageSquare },
  { id: 'kanban', label: 'Kanban Board', icon: LayoutGrid },
]

export default function WorkspacePage() {
  const [tab, setTab] = useState('chat')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 pt-4 border-b pb-0 flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all border-b-2',
              tab === id
                ? 'text-brand-300 border-brand-500'
                : 'text-secondary border-transparent hover:text-primary hover:border-white/20'
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'chat'   && <ChatInterface />}
        {tab === 'kanban' && <KanbanBoard />}
      </div>
    </div>
  )
}
