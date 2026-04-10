import { X, Settings2, Video, Hash, Clock, AlignLeft, Cpu } from 'lucide-react'
import { motion } from 'framer-motion'
import { create } from 'zustand'

// Global settings store accessible from any page
export const useSettings = create((set) => ({
  numTopics: 3,
  channel: 'TikTok chung',
  duration: 60,
  voiceTone: 'Vùi vẻ, thân thiện',
  aiStyle: 'AI Avatar (HeyGen)',
  setNumTopics: (v) => set({ numTopics: v }),
  setChannel: (v) => set({ channel: v }),
  setDuration: (v) => set({ duration: v }),
  setVoiceTone: (v) => set({ voiceTone: v }),
  setAiStyle: (v) => set({ aiStyle: v }),
}))

export default function RightPanel({ onClose }) {
  const { numTopics, channel, duration, voiceTone, aiStyle, setNumTopics, setChannel, setDuration, setVoiceTone, setAiStyle } = useSettings()

  return (
    <motion.aside
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="w-72 flex-shrink-0 flex flex-col h-full border-l"
      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-brand-400" />
          <span className="font-semibold text-sm text-primary">Thông số</span>
        </div>
        <button onClick={onClose} className="btn-icon">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
        {/* Number of videos */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wide mb-2">
            <Video size={12} />
            Số lượng video
          </label>
          <div className="flex gap-2">
            {[2, 3, 5, 7].map((n) => (
              <button
                key={n}
                onClick={() => setNumTopics(n)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  numTopics === n
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                    : 'text-secondary hover:text-primary'
                }`}
                style={numTopics !== n ? { background: 'var(--bg-card)' } : {}}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Channel */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wide mb-2">
            <Hash size={12} />
            Kênh / Nền tảng
          </label>
          <input
            className="input-base"
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            placeholder="VD: TikTok chính, IG Reels..."
          />
        </div>

        {/* Duration */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wide mb-2">
            <Clock size={12} />
            Độ dài kịch bản (giây): <span className="text-brand-300 normal-case">{duration}s</span>
          </label>
          <input
            type="range"
            min={15}
            max={180}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full accent-violet-500"
          />
          <div className="flex justify-between text-[11px] text-secondary mt-1">
            <span>15s</span><span>60s</span><span>180s</span>
          </div>
        </div>

        {/* AI Production Type */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wide mb-2">
            <Cpu size={12} />
            Dạng sản xuất AI
          </label>
          <select
            className="input-base"
            value={aiStyle}
            onChange={(e) => setAiStyle(e.target.value)}
          >
            <option>AI Avatar (HeyGen)</option>
            <option>Stock + AI Voice (ElevenLabs)</option>
            <option>AI Image Slideshow (Midjourney)</option>
            <option>Text Animation (CapCut AI)</option>
            <option>AI Video Gen (Runway/Pika)</option>
          </select>
        </div>

        {/* Voice Tone */}
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wide mb-2">
            <AlignLeft size={12} />
            Giọng văn
          </label>
          <select
            className="input-base"
            value={voiceTone}
            onChange={(e) => setVoiceTone(e.target.value)}
          >
            <option>Vui vẻ, thân thiện</option>
            <option>Chuyên nghiệp, uy tín</option>
            <option>Hài hước, bắt trend</option>
            <option>Cảm xúc, chạm lòng</option>
            <option>Hướng dẫn, giáo dục</option>
          </select>
        </div>

        {/* Divider */}
        <div className="border-t" style={{ borderColor: 'var(--border)' }} />

        {/* Tips */}
        <div
          className="rounded-xl p-4 text-xs space-y-2"
          style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}
        >
          <p className="font-semibold text-brand-300">💡 Mẹo sử dụng</p>
          <p className="text-secondary">Nhấn "Lên kế hoạch hôm nay" để AI tự động tạo {numTopics} ý tưởng video không trùng lặp.</p>
          <p className="text-secondary">Chat tự do với Agent để tìm trend AI video, viết lại kịch bản, hoặc lấy ý tưởng mới.</p>
        </div>
      </div>
    </motion.aside>
  )
}
