import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
 
type PhaseHistory = { id: number; phase: string; notes: string | null; startedAt: string }
type ReagentLog   = {
  id: number; quantityUsed: number; purpose: string; usedAt: string
  item: { name: string; unit: string }; usedBy: { name: string }
}
type RequestDetail = {
  id: number; requestCode: string; sampleName: string
  crop: string | null; season: string | null; year: number | null
  program: string | null; purpose: string | null
  materialStage: string | null; project: string | null
  projectCode: string | null; testType: string
  analysisToBeDone: string | null; traitGene: string | null
  predictedSamples: number | null; actualSamples: number | null
  status: string; currentPhase: string; notes: string | null
  submittedAt: string; expectedByDate: string; completedAt: string | null
  submittedBy: { name: string; email: string }
  assignedLab: { name: string } | null
  phaseHistory: PhaseHistory[]
  reagentLogs: ReagentLog[]
}
 
const PHASE_LABELS: Record<string, string> = {
  SUBMITTED: 'Submitted', RECEIVED: 'Received',
  DNA_ISOLATION: 'DNA Isolation', GENOTYPING: 'Genotyping',
  ANALYSIS: 'Analysis', COMPLETED: 'Completed',
}
 
function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}
 
function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '6px 12px', color: '#6b7280', width: '35%',
                   fontSize: 13, fontWeight: 500 }}>{label}</td>
      <td style={{ padding: '6px 12px', color: '#1f2937', fontSize: 13 }}>{value}</td>
    </tr>
  )
}
 
export default function PrintRequestPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = router.query
 
  const [req, setReq]       = useState<RequestDetail | null>(null)
  const [loading, setLoading] = useState(true)
 
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])
 
  useEffect(() => {
    if (!session || !id) return
    fetch(`/api/requests/${id}`)
      .then(r => r.json())
      .then(data => { setReq(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [session, id])
 
  if (loading || !req) {
    return <div style={{ padding: 40, color: '#9ca3af' }}>Loading...</div>
  }
 
  const printedOn = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
 
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 800,
                  margin: '0 auto', padding: 32 }}>
 
      {/* Print button — hidden when printing */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 12 }}
           className="no-print">
        <button
          onClick={() => window.print()}
          style={{ background: '#1d4ed8', color: '#fff', border: 'none',
                   padding: '8px 20px', borderRadius: 6, cursor: 'pointer',
                   fontSize: 14, fontWeight: 600 }}
        >
          Print / Save as PDF
        </button>
        <button
          onClick={() => router.back()}
          style={{ background: '#f3f4f6', color: '#374151', border: 'none',
                   padding: '8px 20px', borderRadius: 6, cursor: 'pointer',
                   fontSize: 14 }}
        >
          ← Back
        </button>
      </div>
 
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        @page { margin: 1.5cm; }
      `}</style>
 
      {/* Report header */}
      <div style={{ borderBottom: '3px solid #1d4ed8', paddingBottom: 16,
                    marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
          GenomicLab Management System
        </div>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1e3a8a', fontWeight: 700 }}>
          {req.requestCode}
        </h1>
        <div style={{ fontSize: 14, color: '#374151', marginTop: 4 }}>
          {req.sampleName} &nbsp;·&nbsp; {req.testType}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
          Printed on {printedOn}
        </div>
      </div>
 
      {/* Sample details */}
      <h2 style={{ fontSize: 14, color: '#374151', marginBottom: 8,
                   fontWeight: 700, textTransform: 'uppercase',
                   letterSpacing: '0.05em' }}>
        Sample Information
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse',
                      marginBottom: 24, border: '1px solid #e5e7eb' }}>
        <tbody>
          <Row label="Nursery Name"   value={req.sampleName} />
          <Row label="Crop"           value={req.crop        || '—'} />
          <Row label="Season"         value={req.season      || '—'} />
          <Row label="Year"           value={req.year?.toString() || '—'} />
          <Row label="Program"        value={req.program     || '—'} />
          <Row label="Purpose"        value={req.purpose     || '—'} />
          <Row label="Material Stage" value={req.materialStage || '—'} />
          <Row label="Project Code"   value={req.projectCode || '—'} />
          <Row label="Project"        value={req.project     || '—'} />
          <Row label="Analysis"       value={req.analysisToBeDone || '—'} />
          <Row label="Trait / Gene"   value={req.traitGene   || '—'} />
          <Row label="Pred. Samples"  value={req.predictedSamples?.toString() || '—'} />
          <Row label="Actual Samples" value={req.actualSamples?.toString()    || '—'} />
          <Row label="Submitted By"   value={req.submittedBy.name} />
          <Row label="Submitted At"   value={fmt(req.submittedAt)} />
          <Row label="Expected By"    value={fmt(req.expectedByDate)} />
          <Row label="Completed At"   value={fmt(req.completedAt)} />
          <Row label="Status"         value={req.status.replace(/_/g, ' ')} />
        </tbody>
      </table>
 
      {/* Phase history */}
      <h2 style={{ fontSize: 14, color: '#374151', marginBottom: 8,
                   fontWeight: 700, textTransform: 'uppercase',
                   letterSpacing: '0.05em' }}>
        Phase History
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse',
                      marginBottom: 24, border: '1px solid #e5e7eb' }}>
        <thead>
          <tr style={{ background: '#eff6ff' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12,
                         color: '#1e40af', fontWeight: 600 }}>Phase</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12,
                         color: '#1e40af', fontWeight: 600 }}>Date</th>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12,
                         color: '#1e40af', fontWeight: 600 }}>Notes</th>
          </tr>
        </thead>
        <tbody>
          {req.phaseHistory.map(h => (
            <tr key={h.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '6px 12px', fontSize: 13,
                           fontWeight: 500 }}>
                {PHASE_LABELS[h.phase] ?? h.phase}
              </td>
              <td style={{ padding: '6px 12px', fontSize: 13,
                           color: '#6b7280' }}>{fmt(h.startedAt)}</td>
              <td style={{ padding: '6px 12px', fontSize: 13,
                           color: '#6b7280' }}>{h.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
 
      {/* Reagent logs */}
      {req.reagentLogs.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, color: '#374151', marginBottom: 8,
                       fontWeight: 700, textTransform: 'uppercase',
                       letterSpacing: '0.05em' }}>
            Reagents Used
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse',
                          marginBottom: 24, border: '1px solid #e5e7eb' }}>
            <thead>
              <tr style={{ background: '#eff6ff' }}>
                {['Reagent','Qty','Unit','Purpose','Used By','Date'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left',
                                       fontSize: 12, color: '#1e40af',
                                       fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {req.reagentLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '6px 12px', fontSize: 13 }}>{log.item.name}</td>
                  <td style={{ padding: '6px 12px', fontSize: 13 }}>{log.quantityUsed}</td>
                  <td style={{ padding: '6px 12px', fontSize: 13 }}>{log.item.unit}</td>
                  <td style={{ padding: '6px 12px', fontSize: 13 }}>{log.purpose}</td>
                  <td style={{ padding: '6px 12px', fontSize: 13 }}>{log.usedBy.name}</td>
                  <td style={{ padding: '6px 12px', fontSize: 13,
                               color: '#6b7280' }}>{fmt(log.usedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
 
      {req.notes && (
        <>
          <h2 style={{ fontSize: 14, color: '#374151', marginBottom: 8,
                       fontWeight: 700, textTransform: 'uppercase',
                       letterSpacing: '0.05em' }}>Remarks</h2>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
            {req.notes}
          </p>
        </>
      )}
    </div>
  )
}
