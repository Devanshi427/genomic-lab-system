// lib/inventoryImportUtils.ts
// Pure helpers — no server imports. Safe on both client and server.

export type ImportRow = {
  name:              string
  catalogueNumber:   string | null
  brand:             string | null
  category:          string        // derived from type
  type:              'CHEMICAL' | 'CONSUMABLE'
  quantity:          number
  unit:              string
  manufacturingDate: string | null // ISO string or null
  expiryDate:        string | null // ISO string or null
}

export type ImportPreview = {
  rows:     ImportRow[]
  warnings: string[]
}

// Excel column order (0-based):
// Material | Catalogue Number | Brand of Supply | Type | Lab |
// Available Quantity | Unit of Qty | Mfg Date | Expiry Date | Status | Actions
export const COL = {
  name:            0,
  catalogueNumber: 1,
  brand:           2,
  type:            3,
  quantity:        5,
  unit:            6,
  mfgDate:         7,
  expiryDate:      8,
} as const

// "Chemicals" → "CHEMICAL", "Consumables" → "CONSUMABLE"
export function parseType(raw: unknown): 'CHEMICAL' | 'CONSUMABLE' {
  const s = String(raw ?? '').trim().toLowerCase()
  return s.startsWith('consumable') ? 'CONSUMABLE' : 'CHEMICAL'
}

// Handles: numbers, "nil", "1kg", "4pks", "90 pcs", "5 rolls"
export function parseQty(raw: unknown): number {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw
  const s = String(raw).trim().toLowerCase()
  if (!s || s === 'nil') return 0
  const match = s.match(/^[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

// Handles: datetime strings, "No.Mfg Date", "Agu-2023", year "2022", blank
export function parseDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (!s) return null

  const lower = s.toLowerCase()
  if (lower === 'nil' || lower.includes('no.mfg') || lower.includes('no mfg') || lower === 'n/a') return null

  // Pure 4-digit year e.g. "2022"
  if (/^\d{4}$/.test(s)) return `${s}-01-01`

  // datetime string from openpyxl e.g. "2024-12-01 00:00:00"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split(' ')[0]

  // "Agu-2023" or "Aug-2023" (typo normalisation)
  const longYear = s.match(/^([A-Za-z]{3,4})-(\d{4})$/)
  if (longYear) {
    const mon = longYear[1].charAt(0).toUpperCase() + longYear[1].slice(1).toLowerCase()
    const d = new Date(`${mon} 1 ${longYear[2]}`)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }

  // "Dec-24" style
  const shortYear = s.match(/^([A-Za-z]{3})-(\d{2})$/)
  if (shortYear) {
    const d = new Date(`${shortYear[1]} 1 20${shortYear[2]}`)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }

  // Last resort — native parse
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
}

export function parseUnit(raw: unknown): string {
  const s = String(raw ?? '').trim()
  return s || 'units'
}

// Called client-side after SheetJS parses the file
export function parseExcelRows(
  rawRows: unknown[][],
  skipHeader = true,
): ImportPreview {
  const rows: ImportRow[]  = []
  const warnings: string[] = []
  const data = skipHeader ? rawRows.slice(1) : rawRows

  data.forEach((row, i) => {
    const rowNum = i + (skipHeader ? 2 : 1)
    const name   = String(row[COL.name] ?? '').trim()

    if (!name) {
      warnings.push(`Row ${rowNum}: empty name — skipped`)
      return
    }

    const type     = parseType(row[COL.type])
    const quantity = parseQty(row[COL.quantity])
    const rawQty   = String(row[COL.quantity] ?? '').trim().toLowerCase()

    if (quantity === 0 && rawQty !== '' && rawQty !== 'nil') {
      warnings.push(`Row ${rowNum} (${name}): quantity "${row[COL.quantity]}" could not be parsed — stored as 0`)
    }

    rows.push({
      name,
      catalogueNumber: row[COL.catalogueNumber] ? String(row[COL.catalogueNumber]).trim() : null,
      brand:           row[COL.brand]            ? String(row[COL.brand]).trim()            : null,
      category:        type === 'CONSUMABLE' ? 'Consumable' : 'Chemical',
      type,
      quantity,
      unit:              parseUnit(row[COL.unit]),
      manufacturingDate: parseDate(row[COL.mfgDate]),
      expiryDate:        parseDate(row[COL.expiryDate]),
    })
  })

  return { rows, warnings }
}