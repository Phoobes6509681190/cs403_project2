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
      fontFamily: { sans: ['"IBM Plex Sans Thai"', '"Noto Sans Thai"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
