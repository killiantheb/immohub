'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const O = '#D4601A'
const T = '#1C0F06'
const T5 = 'rgba(80,35,8,0.55)'
const T3 = 'rgba(80,35,8,0.30)'
const border = '0.5px solid rgba(160,92,40,0.2)'

interface DashboardData {
  next_rent_due: string | null
  next_rent_amount: number | null
  currency: string
  property_address: string | null
  lease_end_date: string | null
  status: string
  pending_transaction_id: string | null
}

interface HistoryItem {
  id: string
  reference: string
  status: string
  start_date: string | null
  end_date: string | null
  monthly_rent: number | null
  currency: string
  property_address: string | null
  property_type: string | null
  rooms: number | null
  surface: number | null
}

interface DepositInfo {
  status: string
  deposit_amount_chf: number | null
  monthly_rent_chf: number
  months: number
  paid_at: string | null
  contract_id: string | null
  reference: string | null
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ background: '#fff', borderRadius: 16, padding: '20px', border, marginBottom: 12, ...style }}>
      {children}
    </section>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T5, marginBottom: 14 }}>{children}</p>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    ok:       { bg: 'rgba(34,197,94,0.1)',  color: '#16a34a', label: 'À jour' },
    pending:  { bg: 'rgba(234,179,8,0.1)',  color: '#ca8a04', label: 'En attente' },
    late:     { bg: 'rgba(239,68,68,0.1)',  color: '#dc2626', label: 'En retard' },
    active:   { bg: 'rgba(34,197,94,0.1)',  color: '#16a34a', label: 'Actif' },
    terminated:{ bg: 'rgba(100,116,139,0.1)', color: '#64748b', label: 'Terminé' },
    expired:  { bg: 'rgba(100,116,139,0.1)', color: '#64748b', label: 'Expiré' },
    draft:    { bg: 'rgba(234,179,8,0.1)',  color: '#ca8a04', label: 'Brouillon' },
    paid:     { bg: 'rgba(34,197,94,0.1)',  color: '#16a34a', label: 'Payé' },
    no_contract: { bg: 'rgba(100,116,139,0.1)', color: '#64748b', label: 'Aucun bail' },
  }
  const s = map[status] ?? { bg: 'rgba(100,116,139,0.1)', color: '#64748b', label: status }
  return (
    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontWeight: 500 }}>
      {s.label}
    </span>
  )
}

export default function TenantPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [deposit, setDeposit] = useState<DepositInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'deposit'>('current')

  useEffect(() => {
    Promise.all([
      api.get('/tenants/me').then(r => setDashboard(r.data)).catch(() => null),
      api.get('/tenants/me/history').then(r => setHistory(r.data)).catch(() => null),
      api.get('/tenants/me/deposit').then(r => setDeposit(r.data)).catch(() => null),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '3rem 0', textAlign: 'center', color: T5, fontSize: 13 }}>
        Chargement…
      </div>
    )
  }

  const tabs = [
    { key: 'current' as const, label: 'Mon logement' },
    { key: 'history' as const, label: `Historique (${history.length})` },
    { key: 'deposit' as const, label: 'Caution' },
  ]

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem 0' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 300, color: O, letterSpacing: 2, marginBottom: '1.5rem' }}>
        Mon espace locataire
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#fff', borderRadius: 12, padding: 4, border }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', cursor: 'pointer',
              background: activeTab === tab.key ? O : 'transparent',
              color: activeTab === tab.key ? '#fff' : T5,
              fontSize: 12, fontFamily: 'inherit', fontWeight: activeTab === tab.key ? 500 : 400,
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Current */}
      {activeTab === 'current' && (
        <>
          {dashboard ? (
            <>
              <Card>
                <SectionTitle>Statut locatif</SectionTitle>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 600, color: T, marginBottom: 4 }}>
                      {dashboard.property_address ?? 'Aucun bien actif'}
                    </p>
                    {dashboard.lease_end_date && (
                      <p style={{ fontSize: 12, color: T5 }}>
                        Bail jusqu'au {new Date(dashboard.lease_end_date).toLocaleDateString('fr-CH')}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={dashboard.status} />
                </div>
              </Card>

              <Card>
                <SectionTitle>Prochain loyer</SectionTitle>
                {dashboard.next_rent_amount ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: O }}>
                      {dashboard.next_rent_amount.toLocaleString('fr-CH', { minimumFractionDigits: 2 })}
                    </span>
                    <span style={{ fontSize: 14, color: T5 }}>{dashboard.currency}</span>
                    {dashboard.next_rent_due && (
                      <span style={{ fontSize: 12, color: T3, marginLeft: 8 }}>
                        dû le {new Date(dashboard.next_rent_due).toLocaleDateString('fr-CH')}
                      </span>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 14, color: T5 }}>Aucun loyer en attente</p>
                )}
              </Card>
            </>
          ) : (
            <Card>
              <p style={{ fontSize: 14, color: T5, textAlign: 'center' }}>Aucun bail actif trouvé.</p>
            </Card>
          )}
        </>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <>
          {history.length === 0 ? (
            <Card>
              <p style={{ fontSize: 14, color: T5, textAlign: 'center' }}>Aucun historique de logement.</p>
            </Card>
          ) : (
            history.map(item => (
              <Card key={item.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: T, marginBottom: 2 }}>
                      {item.property_address ?? 'Adresse inconnue'}
                    </p>
                    <p style={{ fontSize: 11, color: T3, fontFamily: 'monospace' }}>{item.reference}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {item.start_date && (
                    <div>
                      <p style={{ fontSize: 10, color: T3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Début</p>
                      <p style={{ fontSize: 13, color: T }}>{new Date(item.start_date).toLocaleDateString('fr-CH')}</p>
                    </div>
                  )}
                  {item.end_date && (
                    <div>
                      <p style={{ fontSize: 10, color: T3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Fin</p>
                      <p style={{ fontSize: 13, color: T }}>{new Date(item.end_date).toLocaleDateString('fr-CH')}</p>
                    </div>
                  )}
                  {item.monthly_rent && (
                    <div>
                      <p style={{ fontSize: 10, color: T3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Loyer</p>
                      <p style={{ fontSize: 13, color: T }}>{item.monthly_rent.toLocaleString('fr-CH')} {item.currency}/mois</p>
                    </div>
                  )}
                  {item.surface && (
                    <div>
                      <p style={{ fontSize: 10, color: T3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Surface</p>
                      <p style={{ fontSize: 13, color: T }}>{item.surface} m² — {item.rooms} pièces</p>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </>
      )}

      {/* Deposit */}
      {activeTab === 'deposit' && deposit && (
        <Card>
          <SectionTitle>Caution / Dépôt de garantie</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 28, fontWeight: 700, color: O }}>
                {deposit.deposit_amount_chf?.toLocaleString('fr-CH', { minimumFractionDigits: 2 }) ?? '—'} CHF
              </p>
              <p style={{ fontSize: 12, color: T5 }}>
                {deposit.months} mois × {deposit.monthly_rent_chf.toLocaleString('fr-CH')} CHF/mois
              </p>
              <p style={{ fontSize: 11, color: T3, marginTop: 4 }}>Maximum légal CO art. 257e</p>
            </div>
            <StatusBadge status={deposit.status} />
          </div>
          {deposit.paid_at && (
            <p style={{ fontSize: 12, color: T5 }}>
              Versé le {new Date(deposit.paid_at).toLocaleDateString('fr-CH')}
            </p>
          )}
          {deposit.reference && (
            <p style={{ fontSize: 11, color: T3, marginTop: 8, fontFamily: 'monospace' }}>
              Réf. {deposit.reference}
            </p>
          )}
          <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(212,96,26,0.05)', border: '0.5px solid rgba(212,96,26,0.15)' }}>
            <p style={{ fontSize: 12, color: T5 }}>
              Le dépôt de garantie est déposé sur un compte bancaire bloqué à votre nom. Il vous est restitué à la fin du bail, déduction faite d'éventuels dommages constatés lors de l'état des lieux de sortie.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
