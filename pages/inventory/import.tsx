// pages/inventory/import.tsx
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import * as XLSX from 'xlsx'
import { parseExcelRows } from '../../lib/inventoryImportUtils'
import type { ImportPreview } from '../../lib/inventoryImportUtils'

type Lab = { id: number; name: string }

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ImportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const role      = (session?.user as Record<string, unknown>)?.role as string ?? 'GUEST'
  const canImport = role === 'INVENTORY_MANAGER' || role === 'ADMIN'

  const [labs, setLabs]                   = useState<Lab[]>([])
  const [labId, setLabId]                 = useState('')
  const [minThreshold, setMinThreshold]   = useState('10')
  const [clearExisting, setClearExisting] = useState(false)

  const [fileName, setFileName]           = useState('')
  const [preview, setPreview]             = useState<ImportPreview | null>(null)
  const [importing, setImporting]         = useState(false)
  const [result, setResult]               = useState<number | null>(null)
  const [error, setError]                 = useState('')

  useEffect(() => {
    fetch('/api/labs')
      .then(r => r.json())
      .then((d: Lab[]) => setLabs(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setPreview(null)
    setResult(null)
    setError('')

    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array', cellDates: false, raw: true })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        // Get raw values as strings — we parse dates ourselves
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          defval: null,
          raw:    true,
        })
        setPreview(parseExcelRows(rows))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to read file')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (!preview?.rows.length) return
    if (!labId) { setError('Please select a lab first'); return }

    setImporting(true)
    setError('')

    try {
      const res = await fetch('/api/inventory/import', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows:         preview.rows,
          labId:        parseInt(labId),
          minThreshold: parseFloat(minThreshold) || 10,
          clearExisting,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.imported)
      setPreview(null)
      setFileName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (status === 'loading') return <div className="p-6 text-gray-400">Loading...</div>
  if (!canImport) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        You do not have permission to import inventory.
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Import Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Upload your Excel file to bulk-add items to inventory.</p>
        </div>
        <button onClick={() => router.push('/inventory')}
          className="text-sm text-blue-600 hover:underline">
          ← Back to Inventory
        </button>
      </div>

      {/* Expected format info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
        <p className="font-semibold mb-1">Expected column order (row 1 is header and will be skipped):</p>
        <p className="font-mono text-xs tracking-tight">
          Material · Catalogue Number · Brand of Supply · Type · Lab · Available Quantity · Unit of Qty · Mfg Date · Expiry Date
        </p>
        <p className="text-xs mt-2 opacity-70">
          Type should be <strong>Chemicals</strong> or <strong>Consumables</strong>.
          Quantities like &quot;nil&quot;, &quot;1kg&quot;, &quot;4pks&quot; are handled automatically.
          Dates can be blank, &quot;No.Mfg Date&quot;, a year like 2022, or a full date.
        </p>
      </div>

      {/* Step 1 — File */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Step 1 — Choose Excel file</h2>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl py-10 cursor-pointer hover:border-blue-400 transition-colors">
          <span className="text-4xl mb-2">📂</span>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {fileName || 'Click to upload .xlsx'}
          </span>
          <span className="text-xs text-gray-400 mt-1">Excel .xlsx only</span>
          <input type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {/* Step 2 — Options (only after file chosen) */}
      {preview && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Step 2 — Import options</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Target Lab *</label>
              <select value={labId} onChange={e => setLabId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100">
                <option value="">Select lab...</option>
                {labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Min Stock Threshold</label>
              <input type="number" min="0" value={minThreshold}
                onChange={e => setMinThreshold(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
            <input type="checkbox" checked={clearExisting} onChange={e => setClearExisting(e.target.checked)}
              className="rounded border-gray-300 text-blue-600" />
            <span><span className="text-red-600 font-medium">Delete existing items</span> for this lab before importing</span>
          </label>
        </div>
      )}

      {/* Warnings */}
      {preview && preview.warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
            ⚠ {preview.warnings.length} warning{preview.warnings.length !== 1 ? 's' : ''}
          </p>
          <ul className="space-y-0.5">
            {preview.warnings.map((w, i) => (
              <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Preview table */}
      {preview && preview.rows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Preview — {preview.rows.length} rows ready to import
            </p>
            <button onClick={handleImport} disabled={importing || !labId}
              className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {importing ? 'Importing...' : `Import ${preview.rows.length} items`}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  {['#', 'Material', 'Cat No.', 'Brand', 'Type', 'Qty', 'Unit', 'Mfg Date', 'Expiry'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {preview.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100 max-w-52 truncate">{row.name}</td>
                    <td className="px-3 py-2 text-gray-400 max-w-28 truncate">{row.catalogueNumber || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.brand || '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                        row.type === 'CHEMICAL'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-teal-100 text-teal-700'
                      }`}>
                        {row.type === 'CHEMICAL' ? '🧪' : '🧴'} {row.type}
                      </span>
                    </td>
                    <td className={`px-3 py-2 tabular-nums font-semibold ${row.quantity === 0 ? 'text-gray-300' : 'text-gray-800 dark:text-gray-100'}`}>
                      {row.quantity}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{row.unit}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtDate(row.manufacturingDate)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${row.expiryDate ? 'text-orange-600 font-medium' : 'text-gray-300'}`}>
                      {fmtDate(row.expiryDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Success */}
      {result !== null && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-8 text-center">
          <p className="text-3xl mb-3">✅</p>
          <p className="text-green-800 dark:text-green-300 font-semibold text-lg">
            {result} items imported successfully
          </p>
          <button onClick={() => router.push('/inventory')}
            className="mt-4 px-5 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
            Go to Inventory
          </button>
        </div>
      )}

    </div>
  )
}