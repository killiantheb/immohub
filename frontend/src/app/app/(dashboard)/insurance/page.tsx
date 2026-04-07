'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const O = '#D4601A'
const T = '#1C0F06'
const T5 = 'rgba(80,35,8,0.55)'
const T3 = 'rgba(80,35,8,0.30)'
const border = '0.5px solid rgba(160,92,40,0.2)'

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Brouillon',  color: '#ca8a04' },
  quoted:   { label: 'Offre déposée', color: O },
  accepted: { label: 'Acceptée',   color: '#16a34a' },
  rejected: { label: 'Rejetée',    color: '#dc2626' },
  open:     { label: 'Ouvert',     color: '#16a34a' },
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
      // Refresh
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
    return <div style={{ textAlign: 'center', padding: '3rem', color: T5, fontSize: 13 }}>Chargement…</div>
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem 0' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 300, color: O, letterSpacing: 2, marginBottom: '1.5rem' }}>
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
            <div key={kpi.label} style={{ background: '#fff', borderRadius: 14, padding: '16px 18px', border }}>
              <p style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, marginBottom: 6 }}>{kpi.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: T }}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {success && (
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '0.5px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#16a34a', fontSize: 13 }}>
          {success}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#fff', borderRadius: 12, padding: 4, border, width: 'fit-content' }}>
        {[
          { key: 'offers' as const, label: `Mes offres (${dashboard?.total_offers ?? 0})` },
          { key: 'rfqs' as const, label: `Appels d'offre (${rfqs.length})` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', background: tab === t.key ? O : 'transparent', color: tab === t.key ? '#fff' : T5, fontSize: 13, fontFamily: 'inherit', transition: 'all 0.15s' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Offers tab */}
      {tab === 'offers' && (
        <>
          {dashboard?.offers.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: '40px', border, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: T5 }}>Aucune offre déposée. Consultez les appels d'offre ouverts.</p>
            </div>
          ) : (
            dashboard?.offers.map(offer => {
              const st = STATUS_LABELS[offer.status] ?? { label: offer.status, color: '#64748b' }
              return (
                <div key={offer.id} style={{ background: '#fff', borderRadius: 16, padding: '20px', border, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 16, fontWeight: 600, color: T, marginBottom: 3 }}>{offer.product_name}</p>
                      <p style={{ fontSize: 12, color: T5 }}>{offer.insurer_name}</p>
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${st.color}15`, color: st.color, fontWeight: 500 }}>
                      {st.label}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 10, color: T3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>Prime annuelle</p>
                      <p style={{ fontSize: 16, fontWeight: 600, color: T }}>{fmt(offer.annual_premium_chf)} CHF</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: T3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>Prime mensuelle</p>
                      <p style={{ fontSize: 16, fontWeight: 600, color: T }}>{fmt(offer.monthly_premium_chf)} CHF</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: T3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3 }}>Commission (10%)</p>
                      <p style={{ fontSize: 16, fontWeight: 600, color: O }}>{fmt(offer.commission_chf)} CHF</p>
                    </div>
                  </div>
                  {offer.coverage_details && (
                    <p style={{ fontSize: 12, color: T5, marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(212,96,26,0.04)', border: '0.5px solid rgba(212,96,26,0.1)' }}>
                      {offer.coverage_details}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </>
      )}

      {/* RFQs tab */}
      {tab === 'rfqs' && (
        <>
          {rfqs.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: '40px', border, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: T5 }}>Aucun appel d'offre disponible.</p>
            </div>
          ) : (
            rfqs.map(rfq => {
              const st = STATUS_LABELS[rfq.status] ?? { label: rfq.status, color: '#64748b' }
              return (
                <div key={rfq.id} style={{ background: '#fff', borderRadius: 16, padding: '20px', border, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: T, marginBottom: 4 }}>{rfq.title}</p>
                      {rfq.urgency && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}>{rfq.urgency}</span>}
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${st.color}15`, color: st.color, fontWeight: 500 }}>{st.label}</span>
                  </div>
                  {rfq.description && (
                    <p style={{ fontSize: 13, color: T5, marginBottom: 12, lineHeight: 1.5 }}>{rfq.description}</p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {rfq.budget_max && (
                      <p style={{ fontSize: 13, color: T5 }}>Budget max : <strong style={{ color: T }}>{fmt(rfq.budget_max)} CHF/an</strong></p>
                    )}
                    <button
                      onClick={() => { setRespondRfq(rfq); setSuccess('') }}
                      style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: O, color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Déposer une offre
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: T3, marginTop: 8 }}>
                    Publié le {new Date(rfq.created_at).toLocaleDateString('fr-CH')}
                  </p>
                </div>
              )
            })
          )}
        </>
      )}

      {/* Respond modal */}
      {respondRfq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,15,6,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FAF5EB', borderRadius: 20, padding: '28px', maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 300, color: O, margin: 0 }}>Déposer une offre</h2>
              <button onClick={() => setRespondRfq(null)} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: T5 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: T5, marginBottom: 20 }}>En réponse à : <strong style={{ color: T }}>{respondRfq.title}</strong></p>

            {[
              { label: 'Nom du produit', key: 'product_name', placeholder: 'RC + Ménage Premium' },
              { label: 'Compagnie d\'assurance', key: 'insurer_name', placeholder: 'Zurich Insurance' },
              { label: 'Prime annuelle (CHF)', key: 'annual_premium_chf', placeholder: '850.00', type: 'number' },
              { label: 'Franchise (CHF)', key: 'deductible_chf', placeholder: '200', type: 'number' },
            ].map(({ label, key, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: T5, marginBottom: 6 }}>{label}</label>
                <input
                  type={type ?? 'text'}
                  value={(form as any)[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 13px', border, borderRadius: 10, fontSize: 13, color: T, background: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: T5, marginBottom: 6 }}>Détails de couverture</label>
              <textarea
                value={form.coverage_details}
                onChange={e => setForm(f => ({ ...f, coverage_details: e.target.value }))}
                placeholder="Responsabilité civile jusqu'à 5M CHF, dommages eau, incendie…"
                rows={4}
                style={{ width: '100%', padding: '9px 13px', border, borderRadius: 10, fontSize: 13, color: T, background: '#fff', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: T5, marginBottom: 6 }}>Notes (optionnel)</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Conditions particulières…"
                rows={2}
                style={{ width: '100%', padding: '9px 13px', border, borderRadius: 10, fontSize: 13, color: T, background: '#fff', outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <p style={{ fontSize: 11, color: T3, marginBottom: 16 }}>
              Commission plateforme : 10% = {form.annual_premium_chf ? fmt(parseFloat(form.annual_premium_chf) * 0.1) : '0.00'} CHF/an
            </p>

            <button
              onClick={submitOffer}
              disabled={submitting || !form.product_name || !form.annual_premium_chf}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: submitting ? 'rgba(212,96,26,0.5)' : O, color: '#fff', fontSize: 14, fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {submitting ? 'Dépôt…' : 'Confirmer l\'offre'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
