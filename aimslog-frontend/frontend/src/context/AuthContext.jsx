import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import * as authService from '../services/authService'
import { registerUnauthorizedHandler } from '../services/api'

export const AuthContext = createContext(null)

// เตือนก่อน session หมดอายุกี่นาที (ค่าเวลาจริงกำหนดที่ backend เป็นคนตัดสิน
// ฝั่งนี้แค่เอาไว้เตือน UX ให้ผู้ใช้บันทึกงานทัน)
const SESSION_WARNING_BEFORE_MS = 2 * 60 * 1000
// ไม่มีการใช้งานนานเท่านี้ให้ auto-logout เอง (ป้องกันคนแอบใช้เครื่องที่ลืม lock)
const IDLE_TIMEOUT_MS = 20 * 60 * 1000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // { id, username, name, role }
  const [status, setStatus] = useState('loading') // 'loading' | 'authenticated' | 'guest'
  const [sessionWarning, setSessionWarning] = useState(false)
  const idleTimer = useRef(null)

  const clearSession = useCallback(() => {
    setUser(null)
    setStatus('guest')
    setSessionWarning(false)
  }, [])

  // ให้ axios เรียกกลับมาเคลียร์ state ทันทีที่เจอ 401 จาก backend (token หมดอายุ/ไม่ถูกต้อง)
  useEffect(() => {
    registerUnauthorizedHandler(clearSession)
  }, [clearSession])

  // ตอนโหลดแอปครั้งแรก ถามฝั่ง backend ว่ามี session (httpOnly cookie) ที่ยังใช้ได้อยู่ไหม
  useEffect(() => {
    authService
      .fetchMe()
      .then((data) => {
        setUser(data.user)
        setStatus('authenticated')
      })
      .catch(() => setStatus('guest'))
  }, [])

  const login = useCallback(async (username, password) => {
    const data = await authService.login(username, password)
    setUser(data.user)
    setStatus('authenticated')
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      clearSession()
    }
  }, [clearSession])

  // Auto-logout เมื่อไม่มีการขยับเมาส์/พิมพ์นานเกินกำหนด — ลดความเสี่ยงกรณี
  // ลืมออกจากระบบบนเครื่องที่ใช้ร่วมกัน (สำคัญมากสำหรับงานราชการที่มีเครื่อง shared)
  useEffect(() => {
    if (status !== 'authenticated') return

    const resetTimer = () => {
      clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => {
        logout()
      }, IDLE_TIMEOUT_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(idleTimer.current)
      events.forEach((e) => window.removeEventListener(e, resetTimer))
    }
  }, [status, logout])

  const value = {
    user,
    status, // 'loading' | 'authenticated' | 'guest'
    isAuthenticated: status === 'authenticated',
    role: user?.role ?? null,
    sessionWarning,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
