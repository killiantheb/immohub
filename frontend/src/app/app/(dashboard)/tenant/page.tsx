'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

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

const cardStyle: React.CSSProperties = {
  background: 'var(--althy-surface)',
  border: `1px solid var(--althy-border)`,
  borderRadius: 14,
  boxShadow: 'var(--althy-shadow)',
  padding: 20,
  marginBottom: 12,
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: S.text3, marginBottom: 14, fontWeight: 500 }}>
      {children}
    </p>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    ok:           { bg: S.greenBg,  color: S.green,  label: 'À jour' },
    pending:      { bg: S.amberBg,  color: S.amber,  label: 'En attente' },
    late:         { bg: S.redBg,    color: S.red,    label: 'En retard' },
    active:       { bg: S.greenBg,  color: S.green,  label: 'Actif' },
    terminated:   { bg: S.surface2, color: S.text3,  label: 'Terminé' },
    expired:      { bg: S.surface2, color: S.text3,  label: 'Expiré' },
    draft:        { bg: S.amberBg,  color: S.amber,  label: 'Brouillon' },
    paid:         { bg: S.greenBg,  color: S.green,  label: 'Payé' },
    no_contract:  { bg: S.surface2, color: S.text3,  label: 'Aucun bail' },
  }
  const s = map[status] ?? { bg: S.surface2, color: S.text3, label: status }
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
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '3rem 0', textAlign: 'center', color: S.text3, fontSize: 13 }}>
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
      <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontSize: 28, fontWeight: 400, color: S.text, letterSpacing: 1, marginBottom: '1.5rem' }}>
        Mon espace locataire
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: S.surface, borderRadius: 12, padding: 4, border: `1px solid ${S.border}` }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === tab.key ? S.orange : 'transparent',
              color: activeTab === tab.key ? '#fff' : S.text3,
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: activeTab === tab.key ? 500 : 400,
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
              <section style={cardStyle}>
                <SectionTitle>Statut locatif</SectionTitle>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 600, color: S.text, marginBottom: 4 }}>
                      {dashboard.property_address ?? 'Aucun bien actif'}
                    </p>
                    {dashboard.lease_end_date && (
                      <p style={{ fontSize: 12, color: S.text3 }}>
                        Bail jusqu'au {new Date(dashboard.lease_end_date).toLocaleDateString('fr-CH')}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={dashboard.status} />
                </div>
              </section>

              <section style={cardStyle}>
                <SectionTitle>Prochain loyer</SectionTitle>
                {dashboard.next_rent_amount ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: S.orange }}>
                      {dashboard.next_rent_amount.toLocaleString('fr-CH', { minimumFractionDigits: 2 })}
                    </span>
                    <span style={{ fontSize: 14, color: S.text3 }}>{dashboard.currency}</span>
                    {dashboard.next_rent_due && (
                      <span style={{ fontSize: 12, color: S.text3, marginLeft: 8 }}>
                        dû le {new Date(dashboard.next_rent_due).toLocaleDateString('fr-CH')}
                      </span>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 14, color: S.text3 }}>Aucun loyer en attente</p>
                )}
              </section>
            </>
          ) : (
            <section style={cardStyle}>
              <p style={{ fontSize: 14, color: S.text3, textAlign: 'center' }}>Aucun bail actif trouvé.</p>
            </section>
          )}
        </>
      )}

      {/* History */}
      {activeTab === 'history' && (
        <>
          {history.length === 0 ? (
            <section style={cardStyle}>
              <p style={{ fontSize: 14, color: S.text3, textAlign: 'center' }}>Aucun historique de logement.</p>
            </section>
          ) : (
            history.map(item => (
              <section key={item.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: S.text, marginBottom: 2 }}>
                      {item.property_address ?? 'Adresse inconnue'}
                    </p>
                    <p style={{ fontSize: 11, color: S.text3, fontFamily: 'monospace' }}>{item.reference}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {item.start_date && (
                    <div>
                      <p style={{ fontSize: 10, color: S.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Début</p>
                      <p style={{ fontSize: 13, color: S.text }}>{new Date(item.start_date).toLocaleDateString('fr-CH')}</p>
                    </div>
                  )}
                  {item.end_date && (
                    <div>
                      <p style={{ fontSize: 10, color: S.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Fin</p>
                      <p style={{ fontSize: 13, color: S.text }}>{new Date(item.end_date).toLocaleDateString('fr-CH')}</p>
                    </div>
                  )}
                  {item.monthly_rent && (
                    <div>
                      <p style={{ fontSize: 10, color: S.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Loyer</p>
                      <p style={{ fontSize: 13, color: S.text }}>{item.monthly_rent.toLocaleString('fr-CH')} {item.currency}/mois</p>
                    </div>
                  )}
                  {item.surface && (
                    <div>
                      <p style={{ fontSize: 10, color: S.text3, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 2 }}>Surface</p>
                      <p style={{ fontSize: 13, color: S.text }}>{item.surface} m² — {item.rooms} pièces</p>
                    </div>
                  )}
                </div>
              </section>
            ))
          )}
        </>
      )}

      {/* Deposit */}
      {activeTab === 'deposit' && deposit && (
        <section style={cardStyle}>
          <SectionTitle>Caution / Dépôt de garantie</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 28, fontWeight: 700, color: S.orange }}>
                {deposit.deposit_amount_chf?.toLocaleString('fr-CH', { minimumFractionDigits: 2 }) ?? '—'} CHF
              </p>
              <p style={{ fontSize: 12, color: S.text3 }}>
                {deposit.months} mois × {deposit.monthly_rent_chf.toLocaleString('fr-CH')} CHF/mois
              </p>
              <p style={{ fontSize: 11, color: S.text3, marginTop: 4 }}>Maximum légal CO art. 257e</p>
            </div>
            <StatusBadge status={deposit.status} />
          </div>
          {deposit.paid_at && (
            <p style={{ fontSize: 12, color: S.text3 }}>
              Versé le {new Date(deposit.paid_at).toLocaleDateString('fr-CH')}
            </p>
          )}
          {deposit.reference && (
            <p style={{ fontSize: 11, color: S.text3, marginTop: 8, fontFamily: 'monospace' }}>
              Réf. {deposit.reference}
            </p>
          )}
          <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: S.orangeBg, border: `1px solid ${S.orange}` }}>
            <p style={{ fontSize: 12, color: S.text2 }}>
              Le dépôt de garantie est déposé sur un compte bancaire bloqué à votre nom. Il vous est restitué à la fin du bail, déduction faite d'éventuels dommages constatés lors de l'état des lieux de sortie.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
