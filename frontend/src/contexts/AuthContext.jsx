import { createContext, useContext, useEffect, useState } from 'react'
import { authApi, goToLogin } from '@/lib/api'

const AuthContext = createContext(null)

// Normalize user object from NOVIVO API response
function extractUser(data) {
  return data?.user || data?.data?.user || data?.data || data
}

function extractToken(data) {
  return data?.token || data?.access_token || data?.data?.token || data?.data?.access_token
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      authApi.me()
        .then((res) => setUser(extractUser(res.data)))
        .catch((err) => {
          localStorage.removeItem('token')
          // Only redirect if it's actually a 401 (expired), not a network error
          if (err.response?.status === 401) {
            goToLogin()
          } else {
            setLoading(false)
          }
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username, password) => {
    const res = await authApi.login(username, password)
    const token = extractToken(res.data)
    if (!token) throw new Error('Không nhận được token từ server')
    localStorage.setItem('token', token)
    const me = await authApi.me()
    const userData = extractUser(me.data)
    setUser(userData)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  // Return safe fallback during HMR / before AuthProvider mounts
  if (!ctx) return { user: null, loading: true, login: async () => {}, logout: () => {} }
  return ctx
}
