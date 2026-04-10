import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Settings, Key, Bot, FlaskConical, CheckCircle, XCircle,
  Eye, EyeOff, Loader2, Save, RefreshCw, Zap, Info
} from 'lucide-react'
import { settingsApi } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', badge: 'Khuyên dùng' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', badge: 'Tiết kiệm' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', badge: 'Mạnh nhất' },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const isAdmin = ['admin', 'superadmin', 'manager'].includes(user?.role)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)   // null | {ok, response, model} | {error}
  const [testingTavily, setTestingTavily] = useState(false)
  const [tavilyTestResult, setTavilyTestResult] = useState(null)

  // Form state
  const [geminiKey, setGeminiKey] = useState('')
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash')

  const [tavilyKey, setTavilyKey] = useState('')

  // Key visibility
  const [showGemini, setShowGemini] = useState(false)
  const [showTavily, setShowTavily] = useState(false)

  // Remote state (to detect changes)
  const [remote, setRemote] = useState({})

  const load = async () => {
    setLoading(true)
    try {
      const r = await settingsApi.get()
      const d = r.data
      setRemote(d)
      // Only pre-fill key field if admin (non-admin gets masked value)
      setGeminiKey(isAdmin ? (d.gemini_api_key || '') : '')
      setGeminiModel(d.gemini_model || 'gemini-2.5-flash')
      setTavilyKey(isAdmin ? (d.tavily_api_key || '') : '')
    } catch {
      toast.error('Không tải được cài đặt')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const save = async () => {
    if (!isAdmin) return
    setSaving(true)
    setTestResult(null)
    try {
      const payload = {}
      if (geminiKey !== remote.gemini_api_key) payload.gemini_api_key = geminiKey
      if (geminiModel !== remote.gemini_model) payload.gemini_model = geminiModel
      if (tavilyKey !== remote.tavily_api_key) payload.tavily_api_key = tavilyKey

      if (Object.keys(payload).length === 0) {
        toast('Không có thay đổi nào', { icon: 'ℹ️' })
        return
      }
      await settingsApi.update(payload)
      toast.success('Đã lưu cài đặt!')
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Lỗi khi lưu cài đặt')
    } finally {
      setSaving(false)
    }
  }

  const testGemini = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await settingsApi.testGemini(geminiKey, geminiModel)
      setTestResult(r.data)
      toast.success('Gemini API Key hợp lệ!')
    } catch (err) {
      const detail = err.response?.data?.detail || 'Kết nối thất bại'
      setTestResult({ error: detail })
      toast.error(detail)
    } finally {
      setTesting(false)
    }
  }

  const testTavily = async () => {
    setTestingTavily(true)
    setTavilyTestResult(null)
    try {
      const r = await settingsApi.testTavily(tavilyKey)
      setTavilyTestResult(r.data)
      toast.success('Tavily API Key hợp lệ!')
    } catch (err) {
      const detail = err.response?.data?.detail || 'Kết nối thất bại'
      setTavilyTestResult({ error: detail })
      toast.error(detail)
    } finally {
      setTestingTavily(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={24} className="animate-spin text-brand-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <Settings size={20} className="text-brand-400" />
        <h1 className="font-bold text-lg text-primary">Cài đặt hệ thống</h1>
        {!isAdmin && (
          <span className="ml-2 text-xs px-2 py-1 rounded-lg text-yellow-400" style={{ background: 'rgba(251,191,36,0.12)' }}>
            Chỉ Admin mới có thể chỉnh sửa
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-2xl w-full mx-auto">
        <div className="space-y-5">

          {/* ── Gemini AI ─────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bot size={18} className="text-brand-400" />
              <h2 className="font-semibold text-primary">Google Gemini AI</h2>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-brand-400 hover:underline flex items-center gap-1"
              >
                <Key size={11} /> Lấy API Key
              </a>
            </div>

            {/* Key field */}
            <div className="mb-4">
              <label className="text-xs text-secondary block mb-1.5">
                Gemini API Key
                {remote.gemini_key_set
                  ? <span className="ml-2 text-emerald-400">✓ Đã cấu hình</span>
                  : <span className="ml-2 text-yellow-400">⚠ Chưa cấu hình</span>
                }
              </label>
              <div className="relative">
                <input
                  type={showGemini ? 'text' : 'password'}
                  className="input-base pr-10"
                  placeholder={isAdmin ? 'AIza...' : '(chỉ admin xem được)'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  disabled={!isAdmin}
                />
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowGemini(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
                  >
                    {showGemini ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-secondary mt-1.5 flex items-start gap-1">
                <Info size={11} className="flex-shrink-0 mt-0.5" />
                Nếu để trống, hệ thống dùng giá trị trong file <code className="text-brand-300">.env</code>
              </p>
            </div>

            {/* Model selector */}
            <div className="mb-4">
              <label className="text-xs text-secondary block mb-1.5">Model AI</label>
              <div className="grid grid-cols-2 gap-2">
                {GEMINI_MODELS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => isAdmin && setGeminiModel(m.value)}
                    className={`p-3 rounded-xl text-left transition-all border ${
                      geminiModel === m.value
                        ? 'border-brand-500 bg-brand-500/10'
                        : 'border-transparent hover:border-white/10'
                    }`}
                    style={{ background: geminiModel === m.value ? undefined : 'var(--bg-secondary)' }}
                  >
                    <p className="text-xs font-medium text-primary">{m.label}</p>
                    <span className="text-[10px] text-brand-300">{m.badge}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`rounded-xl p-3 flex items-start gap-2 mb-4 text-sm ${
                testResult.ok
                  ? 'text-emerald-300'
                  : 'text-red-300'
              }`} style={{ background: testResult.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                {testResult.ok
                  ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                  : <XCircle size={16} className="flex-shrink-0 mt-0.5" />
                }
                <div>
                  {testResult.ok
                    ? <><span className="font-semibold">Kết nối thành công!</span> Model: <code>{testResult.model}</code> — phản hồi: "{testResult.response}"</>
                    : <><span className="font-semibold">Thất bại:</span> {testResult.error}</>
                  }
                </div>
              </div>
            )}

            {/* Actions */}
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={testGemini}
                  disabled={testing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-cyan-400 border border-cyan-400/30 hover:bg-cyan-400/10 transition-colors"
                >
                  {testing ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
                  Kiểm tra kết nối
                </button>
                <button
                  type="button"
                  onClick={() => { setGeminiKey(''); setShowGemini(false) }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-secondary hover:text-primary hover:bg-white/5 transition-colors"
                  title="Xóa key (dùng .env)"
                >
                  <RefreshCw size={13} /> Dùng .env
                </button>
              </div>
            )}
          </motion.div>

          {/* ── Tavily Search ─────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={18} className="text-yellow-400" />
              <h2 className="font-semibold text-primary">Tavily Search API</h2>
              <span className="text-[11px] text-secondary ml-1">(tuỳ chọn — tìm kiếm xu hướng)</span>
              <a
                href="https://app.tavily.com"
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs text-brand-400 hover:underline flex items-center gap-1"
              >
                <Key size={11} /> Lấy API Key
              </a>
            </div>

            <div>
              <label className="text-xs text-secondary block mb-1.5">
                Tavily API Key
                {remote.tavily_key_set
                  ? <span className="ml-2 text-emerald-400">✓ Đã cấu hình</span>
                  : <span className="ml-2 text-secondary">— Chưa cấu hình</span>
                }
              </label>
              <div className="relative">
                <input
                  type={showTavily ? 'text' : 'password'}
                  className="input-base pr-10"
                  placeholder={isAdmin ? 'tvly-...' : '(chỉ admin xem được)'}
                  value={tavilyKey}
                  onChange={(e) => setTavilyKey(e.target.value)}
                  disabled={!isAdmin}
                />
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowTavily(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
                  >
                    {showTavily ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-secondary mt-1.5 flex items-start gap-1">
                <Info size={11} className="flex-shrink-0 mt-0.5" />
                Nếu không cấu hình, tính năng tìm kiếm xu hướng sẽ bị tắt.
              </p>
            </div>

            {/* Tavily test result */}
            {tavilyTestResult && (
              <div className={`rounded-xl p-3 flex items-start gap-2 mt-3 text-sm ${
                tavilyTestResult.ok
                  ? 'text-emerald-300'
                  : 'text-red-300'
              }`} style={{ background: tavilyTestResult.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                {tavilyTestResult.ok
                  ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                  : <XCircle size={16} className="flex-shrink-0 mt-0.5" />
                }
                <span>{tavilyTestResult.ok ? tavilyTestResult.message : <><span className="font-semibold">Thất bại:</span> {tavilyTestResult.error}</>}</span>
              </div>
            )}

            {/* Tavily test button */}
            {isAdmin && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={testTavily}
                  disabled={testingTavily}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/10 transition-colors"
                >
                  {testingTavily ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
                  Kiểm tra kết nối
                </button>
              </div>
            )}
          </motion.div>

          {/* ── Save button ───────────────────────────── */}
          {isAdmin && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <button
                onClick={save}
                disabled={saving}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Lưu cài đặt
              </button>
              <p className="text-[11px] text-secondary text-center mt-2">
                Key được lưu trong database — không cần khởi động lại server.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
