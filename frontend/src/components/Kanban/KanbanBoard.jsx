import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { motion } from 'framer-motion'
import { Loader2, RefreshCw } from 'lucide-react'
import KanbanCard from './KanbanCard'
import { contentApi } from '@/lib/api'
import { KANBAN_STATUSES } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUS_ICONS = {
  'Ý tưởng':   '💡',
  'Đang tạo AI': '🤖',
  'Hoàn thiện':   '✅',
  'Đã đăng':   '✅',
}

const STATUS_HEADER_COLORS = {
  'Ý tưởng':   'border-blue-500/40 bg-blue-500/5',
  'Đang tạo AI': 'border-yellow-500/40 bg-yellow-500/5',
  'Hoàn thiện':   'border-purple-500/40 bg-purple-500/5',
  'Đã đăng':   'border-green-500/40 bg-green-500/5',
}

export default function KanbanBoard() {
  const [columns, setColumns] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchKanban = async () => {
    setLoading(true)
    try {
      const res = await contentApi.getKanban()
      setColumns(res.data)
    } catch {
      toast.error('Không thể tải Kanban board')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchKanban() }, [])

  const handleDragEnd = async (result) => {
    const { draggableId, destination } = result
    if (!destination) return
    const newStatus = destination.droppableId
    const id = parseInt(draggableId)

    // Optimistic update
    setColumns((prev) => {
      const next = { ...prev }
      let movedCard = null
      for (const s of KANBAN_STATUSES) {
        const idx = next[s]?.findIndex((c) => c.id === id)
        if (idx > -1) {
          movedCard = next[s][idx]
          next[s] = next[s].filter((_, i) => i !== idx)
          break
        }
      }
      if (movedCard) {
        next[newStatus] = [
          ...next[newStatus].slice(0, destination.index),
          { ...movedCard },
          ...next[newStatus].slice(destination.index),
        ]
      }
      return next
    })

    try {
      await contentApi.updateScript(id, { status: newStatus })
    } catch {
      toast.error('Không thể cập nhật trạng thái')
      fetchKanban()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-secondary">
        <Loader2 size={20} className="animate-spin text-brand-400" />
        <span>Đang tải...</span>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-bold text-base text-primary">📋 Kanban Board</h2>
        <button onClick={fetchKanban} className="btn-ghost text-xs flex items-center gap-1.5">
          <RefreshCw size={12} />
          Làm mới
        </button>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full">
            {KANBAN_STATUSES.map((status) => (
              <div key={status} className="kanban-col flex-shrink-0">
                {/* Column header */}
                <div className={`rounded-xl px-3 py-2.5 border mb-3 ${STATUS_HEADER_COLORS[status]}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary">
                      {STATUS_ICONS[status]} {status}
                    </span>
                    <span
                      className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}
                    >
                      {columns?.[status]?.length || 0}
                    </span>
                  </div>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex flex-col gap-2 min-h-[120px] rounded-xl p-2 transition-colors"
                      style={{
                        background: snapshot.isDraggingOver
                          ? 'rgba(139,92,246,0.06)'
                          : 'transparent',
                        border: snapshot.isDraggingOver
                          ? '1px dashed rgba(139,92,246,0.3)'
                          : '1px dashed transparent',
                      }}
                    >
                      {(columns?.[status] || []).map((card, index) => (
                        <Draggable key={card.id} draggableId={String(card.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={provided.draggableProps.style}
                            >
                              <KanbanCard card={card} isDragging={snapshot.isDragging} onRefresh={fetchKanban} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  )
}
