import { useEffect, useState } from 'react'

// หน่วงค่าก่อนยิง API ค้นหา ลดจำนวน request ตอนผู้ใช้พิมพ์เร็วๆ
export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}
