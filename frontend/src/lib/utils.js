import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export function formatDuration(seconds) {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m${seconds % 60 > 0 ? ` ${seconds % 60}s` : ''}`
}

export function truncate(str, max = 80) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

export const KANBAN_STATUSES = ['Ý tưởng', 'Đang tạo AI', 'Hoàn thiện', 'Đã đăng']

export const STATUS_COLORS = {
  'Ý tưởng':  'bg-blue-500/15 text-blue-300 border-blue-500/20',
  'Đang tạo AI': 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  'Hoàn thiện':  'bg-purple-500/15 text-purple-300 border-purple-500/20',
  'Đã đăng':  'bg-green-500/15 text-green-300 border-green-500/20',
}
