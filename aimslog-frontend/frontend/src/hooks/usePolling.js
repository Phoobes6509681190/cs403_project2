import { useEffect, useRef, useState } from 'react'

// Sprint 4: "Real-time ใช้ Polling หรือ WebSocket" — เลือก Polling เพราะ
// ข้อมูลความคืบหน้าตรวจนับไม่จำเป็นต้องเป๊ะระดับวินาที การเรียกซ้ำทุกๆ 2-3 วิ
// ก็เพียงพอกับ UX และ implement/debug ง่ายกว่า WebSocket มาก (ดู README)
export function usePolling(fetchFn, { intervalMs = 3000, enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const savedFetch = useRef(fetchFn)
  savedFetch.current = fetchFn

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let timer

    const tick = async () => {
      try {
        const result = await savedFetch.current()
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) timer = setTimeout(tick, intervalMs)
      }
    }

    tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [enabled, intervalMs])

  return { data, error }
}
