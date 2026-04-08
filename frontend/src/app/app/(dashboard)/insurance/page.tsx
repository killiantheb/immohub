'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

// ── Althy tokens ──────────────────────────────────────────────────────────────
const S = {
  bg: "var(--althy-bg)",
  surface: "var(--althy-surface)",
  surface2: "var(--althy-surface-2)",
  border: "var(--althy-border)",
  text: "var(--althy-text)",
  text2: "var(--althy-text-2)",
  text3: "var(--althy-text-3)",
  orange: "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg)",
  green: "var(--althy-green)",
  greenBg: "var(--althy-green-bg)",
  red: "var(--althy-red)",
  redBg: "var(--althy-red-bg)",
  amber: "var(--althy-amber)",
  amberBg: "var(--althy-amber-bg)",
  blue: "var(--althy-blue)",
  blueBg: "var(--althy-blue-bg)",
  shadow: "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const

interface InsuranceDashboard {
  total_offers: number
  accepted_offers: number
  total_commission_chf: number
  pending_rfqs: number
  offers: InsuranceOffer[]
}

interface InsuranceOffer {
  id: string
  rfq_id: string
  product_name: string
  insurer_name: string
  annual_premium_chf: number
  monthly_premium_chf: number
  coverage_details: string
  deductible_chf: number
  commission_pct: number
  commission_chf: number
  net_premium_chf: number
  notes: string | null
  created_by_id: string
  status: string
}

interface OpenRfq {
  id: string
  title: string
  description: string
  status: string
  urgency: string | null
  budget_max: number | null
  created_at: string
}

function fmt(n: number) {
  return n.toLocaleString('fr-CH', { minimumFractionDigits: 2 })
}

function statusColor(status: string): string {
  if (status === 'accepted' || status === 'open') return S.green
  if (status === 'quoted') return S.orange
  if (status === 'draft') return S.amber
  if (status === 'rejected') return S.red
  return S.text3
}

function statusBg(status: string): string {
  if (status === 'accepted' || status === 'open') return S.greenBg
  if (status === 'quoted') return S.orangeBg
  if (status === 'draft') return S.amberBg
  if (status === 'rejected') return S.redBg
  return S.bg
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Brouillon',
    quoted: 'Offre déposée',
    accepted: 'Acceptée',
    rejected: 'Rejetée',
    open: 'Ouvert',
  }
  return map[status] ?? status
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 13px',
  border: `1px solid ${S.border}`,
  borderRadius: 10,
  fontSize: 13,
  color: S.text,
  background: S.surface,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export default function InsurancePage() {
  const [dashboard, setDashboard] = useState<InsuranceDashboard | null>(null)
  const [rfqs, setRfqs] = useState<OpenRfq[]>([])
  const [tab, setTab] = useState<'offers' | 'rfqs'>('offers')
  const [loading, setLoading] = useState(true)
  const [respondRfq, setRespondRfq] = useState<OpenRfq | null>(null)
  const [form, setForm] = useState({ product_name: '', insurer_name: '', annual_premium_chf: '', coverage_details: '', deductible_chf: '0', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/insurance/dashboard').then(r => setDashboard(r.data)).catch(() => null),
      api.get('/insurance/rfqs').then(r => setRfqs(r.data)).catch(() => null),
    ]).finally(() => setLoading(false))
  }, [])

  async function submitOffer() {
    if (!respondRfq) return
    setSubmitting(true)
    try {
      await api.post(`/insurance/rfqs/${respondRfq.id}/respond`, {
        rfq_id: respondRfq.id,
        product_name: form.product_name,
        insurer_name: form.insurer_name,
        annual_premium_chf: parseFloat(form.annual_premium_chf),
        coverage_details: form.coverage_details,
        deductible_chf: parseFloat(form.deductible_chf) || 0,
        commission_pct: 10,
        notes: form.notes || null,
      })
      setSuccess('Offre déposée avec succès.')
      setRespondRfq(null)
      setForm({ product_name: '', insurer_name: '', annual_premium_chf: '', coverage_details: '', deductible_chf: '0', notes: '' })
      const [d, r] = await Promise.all([
        api.get('/insurance/dashboard'),
        api.get('/insurance/rfqs'),
      ])
      setDashboard(d.data)
      setRfqs(r.data)
    } catch {
      setSuccess('Erreur lors du dépôt.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: S.text2, fontSize: 13 }}>Chargement…</div>
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem 0', fontFamily: 'var(--font-sans)' }}>
      <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontSize: 26, fontWeight: 400, color: S.orange, letterSpacing: 2, marginBottom: '1.5rem' }}>
        Espace assureur
      </h1>

      {/* KPIs */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Offres déposées', value: String(dashboard.total_offers) },
            { label: 'Offres acceptées', value: String(dashboard.accepted_offers) },
            { label: 'Commissions CHF', value: fmt(dashboard.total_commission_chf) },
            { label: 'Appels ouverts', value: String(dashboard.pending_rfqs) },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: S.surface, borderRadius: 14, padding: '16px 18px', border: `1px solid ${S.border}`, boxShadow: S.shadow }}>
              <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: S.text3, marginBottom: 6 }}>{kpi.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: S.text }}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {success && (
        <div style={{ background: S.greenBg, border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: S.green, fontSize: 13 }}>
          {success}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: S.surface, borderRadius: 12, padding: 4, border: `1px solid ${S.border}`, width: 'fit-content', boxShadow: S.shadow }}>
        {[
          { key: 'offers' as const, label: `Mes offres (${dashboard?.total_offers ?? 0})` },
          { key: 'rfqs' as const, label: `Appels d'offre (${rfqs.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', background: tab === t.key ? S.orange : 'transparent', color: tab === t.key ? '#fff' : S.text2, fontSize: 13, fontFamily: 'inherit', transition: 'all 0.15s' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Offers tab */}
      {tab === 'offers' && (
        <>
          {dashboard?.offers.length === 0 ? (
            <div style={{ background: S.surface, borderRadius: 16, padding: '40px', border: `1px solid ${S.border}`, textAlign: 'center', boxShadow: S.shadow }}>
              <p style={{ fontSize: 14, color: S.text2 }}>Aucune offre déposée. Consultez les appels d'offre ouverts.</p>
            </div>
          ) : (
            dashboard?.offers.map(offer => (
              <div key={offer.id} style={{ background: S.surface, borderRadius: 16, padding: '20px', border: `1px solid ${S.border}`, marginBottom: 12, boxShadow: S.shadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 600, color: S.text, marginBottom: 3 }}>{offer.product_name}</p>
                    <p style={{ fontSize: 13, color: S.text2 }}>{offer.insurer_name}</p>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: statusBg(offer.status), color: statusColor(offer.status), fontWeight: 500 }}>
                    {statusLabel(offer.status)}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div>
                    <p style={{ fontSize: 10, color: S.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>Prime annuelle</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: S.text }}>{fmt(offer.annual_premium_chf)} CHF</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: S.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>Prime mensuelle</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: S.text }}>{fmt(offer.monthly_premium_chf)} CHF</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: S.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>Commission (10%)</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: S.orange }}>{fmt(offer.commission_chf)} CHF</p>
                  </div>
                </div>
                {offer.coverage_details && (
                  <p style={{ fontSize: 13, color: S.text2, marginTop: 10, padding: '8px 12px', borderRadius: 8, background: S.orangeBg, border: `1px solid ${S.border}` }}>
                    {offer.coverage_details}
                  </p>
                )}
              </div>
            ))
          )}
        </>
      )}

      {/* RFQs tab */}
      {tab === 'rfqs' && (
        <>
          {rfqs.length === 0 ? (
            <div style={{ background: S.surface, borderRadius: 16, padding: '40px', border: `1px solid ${S.border}`, textAlign: 'center', boxShadow: S.shadow }}>
              <p style={{ fontSize: 14, color: S.text2 }}>Aucun appel d'offre disponible.</p>
            </div>
          ) : (
            rfqs.map(rfq => (
              <div key={rfq.id} style={{ background: S.surface, borderRadius: 16, padding: '20px', border: `1px solid ${S.border}`, marginBottom: 12, boxShadow: S.shadow }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: S.text, marginBottom: 4 }}>{rfq.title}</p>
                    {rfq.urgency && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: S.redBg, color: S.red }}>{rfq.urgency}</span>}
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: statusBg(rfq.status), color: statusColor(rfq.status), fontWeight: 500 }}>{statusLabel(rfq.status)}</span>
                </div>
                {rfq.description && (
                  <p style={{ fontSize: 13, color: S.text2, marginBottom: 12, lineHeight: 1.5 }}>{rfq.description}</p>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {rfq.budget_max && (
                    <p style={{ fontSize: 13, color: S.text2 }}>Budget max : <strong style={{ color: S.text }}>{fmt(rfq.budget_max)} CHF/an</strong></p>
                  )}
                  <button
                    onClick={() => { setRespondRfq(rfq); setSuccess('') }}
                    style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: S.orange, color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Déposer une offre
                  </button>
                </div>
                <p style={{ fontSize: 12, color: S.text3, marginTop: 8 }}>
                  Publié le {new Date(rfq.created_at).toLocaleDateString('fr-CH')}
                </p>
              </div>
            ))
          )}
        </>
      )}

      {/* Respond modal */}
      {respondRfq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: S.bg, borderRadius: 20, padding: '28px', maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: S.shadowMd }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontSize: 20, fontWeight: 400, color: S.orange, margin: 0 }}>Déposer une offre</h2>
              <button onClick={() => setRespondRfq(null)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: S.text2 }}>x</button>
            </div>
            <p style={{ fontSize: 13, color: S.text2, marginBottom: 20 }}>En réponse à : <strong style={{ color: S.text }}>{respondRfq.title}</strong></p>

            {[
              { label: 'Nom du produit', key: 'product_name', placeholder: 'RC + Ménage Premium' },
              { label: "Compagnie d'assurance", key: 'insurer_name', placeholder: 'Zurich Insurance' },
              { label: 'Prime annuelle (CHF)', key: 'annual_premium_chf', placeholder: '850.00', type: 'number' },
              { label: 'Franchise (CHF)', key: 'deductible_chf', placeholder: '200', type: 'number' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: S.text2, marginBottom: 6 }}>{label}</label>
                <input
                  type={type ?? 'text'}
                  value={(form as Record<string, string>)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={inputStyle}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: S.text2, marginBottom: 6 }}>Détails de couverture</label>
              <textarea
                value={form.coverage_details}
                onChange={e => setForm(f => ({ ...f, coverage_details: e.target.value }))}
                placeholder="Responsabilité civile jusqu'à 5M CHF, dommages eau, incendie…"
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: S.text2, marginBottom: 6 }}>Notes (optionnel)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Conditions particulières…"
                rows={2}
                style={{ ...inputStyle, resize: 'none' }}
              />
            </div>

            <p style={{ fontSize: 12, color: S.text3, marginBottom: 16 }}>
              Commission plateforme : 10% = {form.annual_premium_chf ? fmt(parseFloat(form.annual_premium_chf) * 0.1) : '0.00'} CHF/an
            </p>

            <button
              onClick={submitOffer}
              disabled={submitting || !form.product_name || !form.annual_premium_chf}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: submitting ? S.orangeBg : S.orange, color: submitting ? S.orange : '#fff', fontSize: 14, fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {submitting ? 'Dépôt…' : "Confirmer l'offre"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
