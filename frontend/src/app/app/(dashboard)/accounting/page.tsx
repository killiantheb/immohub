'use client'
import { useEffect, useState } from 'react'
import { api, baseURL } from '@/lib/api'
import { createClient } from '@/lib/supabase'

const O = '#D4601A'
const T = '#1C0F06'
const T5 = 'rgba(80,35,8,0.55)'
const T3 = 'rgba(80,35,8,0.30)'
const border = '0.5px solid rgba(160,92,40,0.2)'

interface AccountingRow {
  date: string
  bien: string
  type: string
  statut: string
  montant_CHF: string
  commission_CHF: string
  reference: string
  description: string
}

interface AccountingSummary {
  period: string
  total_loyers_CHF: number
  total_commissions_CHF: number
  total_charges_CHF: number
  net_owner_CHF: number
  transactions: AccountingRow[]
}

const TYPE_LABELS: Record<string, string> = {
  rent: 'Loyer', deposit: 'Caution', commission: 'Commission',
  service: 'Service', quote: 'Devis', charge: 'Charge', utilities: 'Charges util.',
}

const STATUS_COLOR: Record<string, string> = {
  paid: '#16a34a', pending: '#ca8a04', late: '#dc2626', cancelled: '#64748b',
}

function fmt(n: number) {
  return n.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AccountingPage() {
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState<AccountingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  async function load(m: string) {
    setLoading(true)
    try {
      const r = await api.get('/agency/accounting/export', { params: { month: m, format: 'json' } })
      setData(r.data)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(month) }, [month])

  async function exportCsv() {
    setExporting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const url = `${baseURL}/api/v1/agency/accounting/export?month=${month}&format=csv`
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `immohub_compta_${month}.csv`
      a.click()
    } finally {
      setExporting(false)
    }
  }

  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 300, color: O, letterSpacing: 2, margin: 0 }}>
          Comptabilité fiduciaire
        </h1>
        <button
          onClick={exportCsv}
          disabled={exporting || !data}
          style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: O, color: '#fff', fontSize: 13, cursor: exporting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: exporting ? 0.6 : 1 }}
        >
          {exporting ? 'Export…' : 'Exporter CSV'}
        </button>
      </div>

      {/* Month selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, background: '#fff', borderRadius: 12, padding: '10px 16px', border, width: 'fit-content' }}>
        <button onClick={prevMonth} style={{ border: 'none', background: 'transparent', color: T5, cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>‹</button>
        <input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          style={{ border: 'none', outline: 'none', fontSize: 14, color: T, fontFamily: 'inherit', background: 'transparent' }}
        />
        <button onClick={nextMonth} style={{ border: 'none', background: 'transparent', color: T5, cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>›</button>
      </div>

      {loading ? (
        <p style={{ color: T5, fontSize: 13, padding: '2rem 0' }}>Chargement…</p>
      ) : !data ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px', border, textAlign: 'center' }}>
          <p style={{ color: T5, fontSize: 14 }}>Aucune donnée pour cette période.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Total loyers', value: data.total_loyers_CHF, accent: false },
              { label: 'Commissions', value: data.total_commissions_CHF, accent: false },
              { label: 'Charges', value: data.total_charges_CHF, accent: false },
              { label: 'Net propriétaire', value: data.net_owner_CHF, accent: true },
            ].map(kpi => (
              <div key={kpi.label} style={{ background: kpi.accent ? O : '#fff', borderRadius: 14, padding: '16px 18px', border: kpi.accent ? 'none' : border }}>
                <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: kpi.accent ? 'rgba(255,255,255,0.7)' : T3, marginBottom: 6 }}>{kpi.label}</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: kpi.accent ? '#fff' : T }}>
                  {fmt(kpi.value)} <span style={{ fontSize: 12, fontWeight: 400 }}>CHF</span>
                </p>
              </div>
            ))}
          </div>

          {/* Transactions table */}
          {data.transactions.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: '30px', border, textAlign: 'center' }}>
              <p style={{ color: T5, fontSize: 14 }}>Aucune transaction ce mois-ci.</p>
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, border, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: border }}>
                      {['Date', 'Bien', 'Type', 'Statut', 'Montant CHF', 'Commission CHF', 'Référence'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, fontWeight: 500, whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((row, i) => (
                      <tr key={i} style={{ borderBottom: i < data.transactions.length - 1 ? '0.5px solid rgba(160,92,40,0.07)' : 'none' }}>
                        <td style={{ padding: '11px 16px', color: T5, whiteSpace: 'nowrap' }}>{row.date}</td>
                        <td style={{ padding: '11px 16px', color: T, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.bien}</td>
                        <td style={{ padding: '11px 16px', color: T5 }}>{TYPE_LABELS[row.type] ?? row.type}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${STATUS_COLOR[row.statut] ?? '#64748b'}15`, color: STATUS_COLOR[row.statut] ?? '#64748b', fontWeight: 500 }}>
                            {row.statut}
                          </span>
                        </td>
                        <td style={{ padding: '11px 16px', color: T, fontWeight: 600, textAlign: 'right' }}>{row.montant_CHF}</td>
                        <td style={{ padding: '11px 16px', color: row.commission_CHF ? O : T3, textAlign: 'right' }}>{row.commission_CHF || '—'}</td>
                        <td style={{ padding: '11px 16px', color: T3, fontFamily: 'monospace', fontSize: 11 }}>{row.reference || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
