import { readFileSync, writeFileSync } from 'fs'
let c = readFileSync('./pages/requests/index.tsx', 'utf8')

// Replace static year options with dynamic
c = c.replace(
  `{[2024,2025,2026,2027,2028].map(y => <option key={y} value={String(y)}>{y}</option>)}`,
  `{Array.from({length: 10}, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={String(y)}>{y}</option>)}`
)

// Remove search filter div
c = c.replace(
  /\s*<div style=\{\{ display: 'flex', flexDirection: 'column', gap: 4 \}\}>\s*<label[^>]*>Search<\/label>\s*<input type="text" placeholder="Search nursery name\.\.\."[\s\S]*?\/>\s*<\/div>/,
  ''
)

writeFileSync('./pages/requests/index.tsx', c)
console.log('Done!')
