/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        brand: 'var(--brand)',
        brandsoft: 'var(--brand-soft)',
        brandink: 'var(--brand-ink)',
        ok: 'var(--ok)',
        oksoft: 'var(--ok-soft)',
        bad: 'var(--bad)',
        badsoft: 'var(--bad-soft)',
        warn: 'var(--warn)',
        warnsoft: 'var(--warn-soft)',
        gone: 'var(--gone)',
        gonesoft: 'var(--gone-soft)',
      },
      boxShadow: { card: 'var(--shadow)' },
      // มุมโค้งน้อยลงทั้งระบบ — ดูเป็นเอกสาร/ทะเบียนมากกว่าแอปสำเร็จรูป
      borderRadius: { lg: '4px', xl: '6px', '2xl': '8px' },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', '"Noto Sans Thai"', 'system-ui', 'sans-serif'],
        // เลขครุภัณฑ์/ตัวเลขในตาราง ใช้ฟอนต์ความกว้างเท่ากัน อ่านเทียบแนวได้ง่าย
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
