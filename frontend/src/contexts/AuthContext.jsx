import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '@/lib/api'

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
        .catch(() => {
          localStorage.removeItem('token')
          window.location.href = '/login'
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
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
