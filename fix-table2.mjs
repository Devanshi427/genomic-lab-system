import { readFileSync, writeFileSync } from 'fs'
let c = readFileSync('./pages/requests/index.tsx', 'utf8')

// Fix all th padding to be spacious
c = c.replace(/className="px-3 py-3 text-left font-medium text-gray-600 dark:text-gray-300"/g, 'style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap", fontSize: 13 }}')

// Fix all td padding to be spacious  
c = c.replace(/className="px-3 py-2 text-gray-700 dark:text-gray-300"/g, 'style={{ padding: "14px 20px", color: "#374151", whiteSpace: "nowrap", fontSize: 13 }}')

// Sticky: Project Code th
c = c.replace(
  /style=\{\{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap", fontSize: 13 \}\}>Project Code/,
  'style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap", fontSize: 13, position: "sticky", left: 0, background: "#f9fafb", zIndex: 3, boxShadow: "2px 0 4px rgba(0,0,0,0.08)" }}>Project Code'
)

// Sticky: Analysis th
c = c.replace(
  /style=\{\{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap", fontSize: 13 \}\}>Analysis/,
  'style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap", fontSize: 13, position: "sticky", left: 160, background: "#f9fafb", zIndex: 3, boxShadow: "2px 0 4px rgba(0,0,0,0.08)" }}>Analysis'
)

// Sticky: Trait/Gene th
c = c.replace(
  /style=\{\{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap", fontSize: 13 \}\}>Trait\/Gene/,
  'style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap", fontSize: 13, position: "sticky", left: 340, background: "#f9fafb", zIndex: 3, boxShadow: "2px 0 4px rgba(0,0,0,0.08)" }}>Trait/Gene'
)

// Sticky: Project Code td
c = c.replace(
  /style=\{\{ padding: "14px 20px", color: "#374151", whiteSpace: "nowrap", fontSize: 13 \}\}>\{r\.projectCode/,
  'style={{ padding: "14px 20px", color: "#374151", whiteSpace: "nowrap", fontSize: 13, position: "sticky", left: 0, background: "#fff", zIndex: 2, boxShadow: "2px 0 4px rgba(0,0,0,0.08)" }}>{r.projectCode'
)

// Sticky: Analysis td
c = c.replace(
  /style=\{\{ padding: "14px 20px", color: "#374151", whiteSpace: "nowrap", fontSize: 13 \}\}>\{r\.analysisToBeDone/,
  'style={{ padding: "14px 20px", color: "#374151", whiteSpace: "nowrap", fontSize: 13, position: "sticky", left: 160, background: "#fff", zIndex: 2, boxShadow: "2px 0 4px rgba(0,0,0,0.08)" }}>{r.analysisToBeDone'
)

// Sticky: Trait/Gene td
c = c.replace(
  /style=\{\{ padding: "14px 20px", color: "#374151", whiteSpace: "nowrap", fontSize: 13 \}\}>\{r\.traitGene/,
  'style={{ padding: "14px 20px", color: "#374151", whiteSpace: "nowrap", fontSize: 13, position: "sticky", left: 340, background: "#fff", zIndex: 2, boxShadow: "2px 0 4px rgba(0,0,0,0.08)" }}>{r.traitGene'
)

// Fix row hover
c = c.replace(/className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"/g, 'style={{ borderBottom: "1px solid #f3f4f6" }} className="hover-row"')

writeFileSync('./pages/requests/index.tsx', c)
console.log('Done!')
