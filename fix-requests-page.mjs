import { readFileSync, writeFileSync } from 'fs'
let c = readFileSync('./pages/requests/index.tsx', 'utf8')

// Fix the filters section - wrap all filter divs in a container div
c = c.replace(
  /\{\/\* Filters \*\/\}\s*<div style/,
  '{/* Filters */}\n      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, alignItems: "flex-end" }}>\n      <div style'
)

writeFileSync('./pages/requests/index.tsx', c)
console.log('Done!')
