import { readFileSync, writeFileSync } from 'fs'
let c = readFileSync('./pages/requests/index.tsx', 'utf8')
c = c.replace(
  /<div className="overflow-x-auto[^"]*"[^>]*>/,
  '<div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>'
)
c = c.replace(
  /<table[^>]*>/,
  '<table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", tableLayout: "auto" }}>'
)
c = c.replace(/<thead[^>]*>/, '<thead style={{ background: "#f9fafb", position: "sticky", top: 0, zIndex: 1 }}>')
c = c.replace(/className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Project Code/g, 'style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#6b7280", position: "sticky", left: 0, background: "#f9fafb", zIndex: 2, whiteSpace: "nowrap" }}>Project Code')
c = c.replace(/className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Analysis/g, 'style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#6b7280", position: "sticky", left: 100, background: "#f9fafb", zIndex: 2, whiteSpace: "nowrap" }}>Analysis')
c = c.replace(/className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Trait\/Gene/g, 'style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#6b7280", position: "sticky", left: 220, background: "#f9fafb", zIndex: 2, whiteSpace: "nowrap" }}>Trait/Gene')
writeFileSync('./pages/requests/index.tsx', c)
console.log('Done!')
