import { useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import * as XLSX from 'xlsx'

type PreviewRow = Record<string, unknown>

type ImportResult = {
  imported: number
  total: number
  skipped: number
  skippedDetails: string[]
  errors: string[]
  message: string
}

export default function ImportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const role = (session?.user as Record<string, unknown>)?.role as string
  const canImportRequests = role === 'ADMIN'

  const [sheetType, setSheetType] = useState<'requests' | 'inventory'>(
    canImportRequests ? 'requests' : 'inventory'
  )
  const [labId, setLabId] = useState('1')
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    router.push('/login')
    return null
  }

  if (role !== 'ADMIN' && role !== 'INVENTORY_MANAGER') {
    return (
      <div className="p-8 max-w-lg">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">Access Denied</p>
          <p className="text-red-600 text-sm mt-1">This page requires the ADMIN or INVENTORY_MANAGER role.</p>
          <button onClick={() => router.push('/dashboard')}
            className="mt-3 text-sm text-blue-600 hover:underline">
            ← Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setError('')
    const reader = new FileReader()
    reader.onload = (evt) => {
      const data = evt.target?.result
      const workbook = XLSX.read(data, { type: 'binary' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as PreviewRow[]
      if (rows.length > 0) {
        setColumns(Object.keys(rows[0]))
        setPreview(rows.slice(0, 5))
      }
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file) return setError('Please select a file first')
    setImporting(true)
    setResult(null)
    setError('')
    const formData = new FormData()
    formData.append('excel', file)
    formData.append('sheetType', sheetType)
    formData.append('labId', labId)
    try {
      const res = await fetch('/api/import/excel', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Import failed')
      else setResult(data)
    } catch {
      setError('Network error during import')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Import Excel Data</h1>

      {/* Step 1: Configure */}
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">1. Configure Import</h2>
        <div className="flex gap-6 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Type</label>
            {canImportRequests ? (
              /* ADMIN sees both options */
              <select
                value={sheetType}
                onChange={e => setSheetType(e.target.value as 'requests' | 'inventory')}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="requests">Requests</option>
                <option value="inventory">Inventory Items</option>
              </select>
            ) : (
              /* INVENTORY_MANAGER sees only inventory, no dropdown */
              <div className="border border-gray-200 bg-gray-50 rounded px-3 py-2 text-sm text-gray-600">
                Inventory Items
              </div>
            )}
          </div>
          {sheetType === 'inventory' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lab</label>
              <select value={labId} onChange={e => setLabId(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="1">Lab 1</option>
                <option value="2">Lab 2</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: File */}
      <div className="bg-white border rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">2. Select Excel File</h2>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          className="block text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {fileName && <p className="text-sm text-gray-500">Selected: <span className="font-medium">{fileName}</span></p>}
        {columns.length > 0 && (
          <div className="text-sm text-gray-600 bg-gray-50 rounded p-3">
            <p className="font-medium mb-1">Columns detected in your file:</p>
            <p className="font-mono text-xs text-gray-500 break-all">{columns.join(', ')}</p>
          </div>
        )}
      </div>

      {/* Step 3: Preview */}
      {preview.length > 0 && (
        <div className="bg-white border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">3. Preview (first {preview.length} rows)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead className="bg-gray-100">
                <tr>
                  {columns.map(col => (
                    <th key={col} className="px-2 py-2 text-left border-r font-medium text-gray-600 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    {columns.map(col => (
                      <td key={col} className="px-2 py-2 border-r text-gray-700 max-w-32 truncate">{String(row[col] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {preview.length > 0 && (
        <div className="bg-white border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">4. Confirm Import</h2>
          <p className="text-sm text-gray-600">
            Rows with missing values will use sensible defaults.
          </p>
          <button onClick={handleImport} disabled={importing}
            className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {importing ? 'Importing...' : 'Import Now'}
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="font-semibold text-green-800 text-lg">✓ {result.imported} of {result.total} rows imported</p>
            <p className="text-green-700 text-sm mt-1">{result.message}</p>
          </div>
          {result.skipped > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-medium text-yellow-800">{result.skipped} rows skipped (duplicates)</p>
              {result.skippedDetails?.length > 0 && (
                <ul className="text-xs text-yellow-700 mt-2 space-y-1 list-disc list-inside">
                  {result.skippedDetails.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              )}
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-medium text-red-800">{result.errors.length} rows had errors:</p>
              <ul className="text-xs text-red-600 mt-2 space-y-1 list-disc list-inside">
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}