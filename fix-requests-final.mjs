import { readFileSync, writeFileSync } from 'fs'
let c = readFileSync('./pages/requests/index.tsx', 'utf8')

// Remove the duplicate/broken filters section and replace with clean version
c = c.replace(
  /\{\/\* Filters \*\/\}[\s\S]*?\{\/\* Table \*\/\}/,
  `{/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Search</label>
          <input type="text" placeholder="Search nursery name..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 13, width: 200 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Project Code</label>
          <input type="text" placeholder="e.g. ICTP002" value={projectCodeF}
            onChange={e => { setProjectCodeF(e.target.value); setPage(1) }}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 13, width: 150 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Year</label>
          <select value={yearF} onChange={e => { setYearF(e.target.value); setPage(1) }}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
            <option value="ALL">All Years</option>
            {[2024,2025,2026,2027,2028].map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Season</label>
          <select value={seasonF} onChange={e => { setSeasonF(e.target.value); setPage(1) }}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
            <option value="ALL">All Seasons</option>
            <option value="RABI">Rabi</option>
            <option value="SUMMER">Summer</option>
            <option value="Kharif">Kharif</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Crop</label>
          <select value={cropF} onChange={e => { setCropF(e.target.value); setPage(1) }}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
            <option value="ALL">All Crops</option>
            <option value="Rice">Rice</option>
            <option value="Cotton">Cotton</option>
            <option value="Corn">Corn</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Analysis</label>
          <select value={analysisF} onChange={e => { setAnalysisF(e.target.value); setPage(1) }}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
            <option value="ALL">All Analysis</option>
            <option value="Foreground">Foreground</option>
            <option value="Background">Background</option>
            <option value="Hybridity_Confirmation">Hybridity Confirmation</option>
            <option value="Purity_Analysis">Purity Analysis</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Status</label>
          <select value={statusF} onChange={e => { setStatusF(e.target.value); setPage(1) }}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 13 }}>
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="RECEIVED">Received</option>
            <option value="DNA_ISOLATION">DNA Isolation</option>
            <option value="GENOTYPING">Genotyping</option>
            <option value="ANALYSIS">Analysis</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>Archived</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '8px 0' }}>
            <input type="checkbox" checked={showArchived} onChange={e => { setShowArchived(e.target.checked); setPage(1) }} />
            Show archived
          </label>
        </div>
        {(role === 'MANAGEMENT' || role === 'ADMIN') && (
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
            <Link href="/reports/monthly" style={{ fontSize: 13, color: '#2563eb' }}>Monthly Report ?</Link>
          </div>
        )}
      </div>
      {/* Table */}`
)

writeFileSync('./pages/requests/index.tsx', c)
console.log('Done!')
