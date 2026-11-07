import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ตอนพัฒนา: ส่งต่อ /api ไปที่ backend (localhost:4000) ให้อยู่โดเมนเดียวกับหน้าเว็บ
// -> cookie login (httpOnly) ใช้งานได้ ไม่ต้องตั้ง CORS
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:4000', changeOrigin: true },
    },
  },
})
