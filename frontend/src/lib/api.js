import axios from 'axios'

// ─── Local backend instance ──────────────────────────────────────────────────
const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 500) {
      console.error('[API 500]', err.config?.url, err.response?.data)
    }
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      // Small delay so any toast can render before redirect
      setTimeout(() => { window.location.href = '/login' }, 300)
    }
    return Promise.reject(err)
  },
)

// ─── NOVIVO external auth instance ──────────────────────────────────────────
const NOVIVO_API = 'https://api.novivo.net/api'

const novivoApi = axios.create({
  baseURL: NOVIVO_API,
  timeout: 15000,
})

novivoApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── Auth (via NOVIVO API) ───────────────────────────────────────────────────
export const authApi = {
  login: (username, password) =>
    novivoApi.post('/auth/login', { username, password }),
  me: () => novivoApi.get('/auth/me'),
  changePassword: (data) => novivoApi.put('/auth/change-password', data),
  updateProfile: (data) => novivoApi.put('/auth/profile', data),
  // Users management (NOVIVO)
  listUsers: () => novivoApi.get('/auth/users'),
  register: (data) => novivoApi.post('/auth/register', data),
}

// ─── Planning ────────────────────────────────────────────────────────────────
export const planningApi = {
  generateTopics: (data) => api.post('/planning/topics', data),
  createScript: (data) => api.post('/planning/script', data),
  getHistory: (params) => api.get('/planning/history', { params }),
  // Ideas CRUD
  listIdeas: (params) => api.get('/planning/ideas', { params }),
  createIdea: (data) => api.post('/planning/ideas', data),
  updateIdea: (id, data) => api.patch(`/planning/ideas/${id}`, data),
  deleteIdea: (id) => api.delete(`/planning/ideas/${id}`),
}

// ─── Content / Kanban ────────────────────────────────────────────────────────
export const contentApi = {
  listScripts: (params) => api.get('/content/scripts', { params }),
  getScript: (id) => api.get(`/content/scripts/${id}`),
  updateScript: (id, data) => api.patch(`/content/scripts/${id}`, data),
  deleteScript: (id) => api.delete(`/content/scripts/${id}`),
  getKanban: () => api.get('/content/kanban'),
}

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  listUsers: () => api.get('/admin/users'),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  getStats: () => api.get('/admin/stats'),
  listKnowledge: (params) => api.get('/admin/knowledge', { params }),
  getKnowledge: (id) => api.get(`/admin/knowledge/${id}`),
  addKnowledge: (data) => api.post('/admin/knowledge', data),
  updateKnowledge: (id, data) => api.patch(`/admin/knowledge/${id}`, data),
  deleteKnowledge: (id) => api.delete(`/admin/knowledge/${id}`),
  crawlKnowledge: (data) => api.post('/admin/knowledge/crawl', data),
}

// ─── Knowledge Sources ───────────────────────────────────────────────────────
export const sourcesApi = {
  list: () => api.get('/admin/sources'),
  create: (data) => api.post('/admin/sources', data),
  update: (id, data) => api.patch(`/admin/sources/${id}`, data),
  delete: (id) => api.delete(`/admin/sources/${id}`),
}

// ─── System Settings ─────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data) => api.patch('/settings', data),
  testGemini: (key, model) => api.post('/settings/test-gemini', { key: key || null, model: model || null }),
  testTavily: (key) => api.post('/settings/test-tavily', { key: key || null }),
}

// ─── Chat (streaming) ────────────────────────────────────────────────────────
export async function* streamChat({ message, history = [], scriptId = null, scriptContext = '' }) {
  const token = localStorage.getItem('token')
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      message,
      history,
      script_id: scriptId,
      script_context: scriptContext,
    }),
  })

  if (!response.ok) throw new Error('Chat request failed')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const chunk = line.slice(6)
        if (chunk === '[DONE]') return
        yield chunk
      }
    }
  }
}

// ─── Chat History ─────────────────────────────────────────────────────────────
export const chatApi = {
  getHistory: (limit = 200) => api.get('/chat/history', { params: { limit } }),
}

export default api
