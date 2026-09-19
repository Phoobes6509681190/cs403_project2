export const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const ICONS = {
  grid: [
    { tag: 'rect', x: 3, y: 3, width: 7, height: 7, rx: 1.5 },
    { tag: 'rect', x: 14, y: 3, width: 7, height: 7, rx: 1.5 },
    { tag: 'rect', x: 3, y: 14, width: 7, height: 7, rx: 1.5 },
    { tag: 'rect', x: 14, y: 14, width: 7, height: 7, rx: 1.5 },
  ],
  box: [
    { tag: 'path', d: 'M20 7.5 12 3 4 7.5v9L12 21l8-4.5v-9Z' },
    { tag: 'path', d: 'm4 7.5 8 4.5 8-4.5M12 12v9' },
  ],
  check: [
    { tag: 'rect', x: 3, y: 4, width: 18, height: 17, rx: 2.5 },
    { tag: 'path', d: 'm8 12.5 2.5 2.5L16 9.5' },
  ],
  file: [
    { tag: 'path', d: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z' },
    { tag: 'path', d: 'M14 3v5h5' },
  ],
  search: [
    { tag: 'circle', cx: 11, cy: 11, r: 7 },
    { tag: 'path', d: 'm20 20-3.5-3.5' },
  ],
  filter: [{ tag: 'path', d: 'M3 5h18l-7 8v6l-4 2v-8L3 5Z' }],
  plus: [{ tag: 'path', d: 'M12 5v14M5 12h14' }],
  down: [{ tag: 'path', d: 'M12 4v11m0 0 4-4m-4 4-4-4M4 20h16' }],
  up: [{ tag: 'path', d: 'M12 20V9m0 0-4 4m4-4 4 4M4 4h16' }],
  edit: [{ tag: 'path', d: 'M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z' }],
  trash: [{ tag: 'path', d: 'M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13' }],
  out: [
    { tag: 'path', d: 'M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5M11 5h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6' },
  ],
  left: [{ tag: 'path', d: 'm14 6-6 6 6 6' }],
  right: [{ tag: 'path', d: 'm10 6 6 6-6 6' }],
  moon: [{ tag: 'path', d: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z' }],
  menu: [{ tag: 'path', d: 'M4 7h16M4 12h16M4 17h16' }],
  tick: [{ tag: 'path', d: 'm6 12.5 4 4 8-9' }],
  x: [{ tag: 'path', d: 'M6 6l12 12M18 6 6 18' }],
  warning: [
    { tag: 'path', d: 'M12 3 2 20h20L12 3Z' },
    { tag: 'path', d: 'M12 10v4' },
    { tag: 'circle', cx: 12, cy: 17, r: 0.6, fill: 'currentColor' },
  ],
  upload: [{ tag: 'path', d: 'M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3' }],
  history: [
    { tag: 'path', d: 'M3 12a9 9 0 1 0 3-6.7' },
    { tag: 'path', d: 'M3 4v5h5' },
    { tag: 'path', d: 'M12 8v5l3 2' },
  ],
  users: [
    { tag: 'circle', cx: 9, cy: 8, r: 3 },
    { tag: 'path', d: 'M3.5 20a5.5 5.5 0 0 1 11 0' },
    { tag: 'path', d: 'M16 8.5a3 3 0 1 1 3.3 5.9' },
    { tag: 'path', d: 'M14.5 14.2c2.6.2 4.7 1.8 5 5.8' },
  ],
  shield: [
    { tag: 'path', d: 'M12 3l7 3v6c0 5-3.4 8.4-7 9-3.6-.6-7-4-7-9V6l7-3Z' },
    { tag: 'path', d: 'm9 12 2 2 4-4' },
  ],
}

export const LOGO_PATH = 'M20 7.5 12 3 4 7.5v9L12 21l8-4.5v-9Z'
