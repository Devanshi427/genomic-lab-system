import { readFileSync, writeFileSync } from 'fs'

let content = readFileSync('./pages/dashboard/index.tsx', 'utf8')

// Fix phase chart
content = content.replace(
  /(<p[^>]*>Requests by Phase<\/p>)\s*<ul[\s\S]*?<\/ul>\s*\{\/\*[\s\S]*?\*\/\}\s*<span[^>]*>[\s\S]*?<\/span>/,
  '$1<div style={{ height: 220 }}><Bar data={phaseChartData} options={barOptions} /></div>'
)

// Fix status chart
content = content.replace(
  /(<p[^>]*>Status Breakdown<\/p>)\s*<ul[\s\S]*?<\/ul>\s*\{\/\*[\s\S]*?\*\/\}/,
  "$1<div style={{ height: 220 }}><Doughnut data={statusChartData} options={doughnutOptions('Status Breakdown')} /></div>"
)

writeFileSync('./pages/dashboard/index.tsx', content)
console.log('Done!')
