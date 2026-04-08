'use client'
import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

// ── Tokens ────────────────────────────────────────────────────────────────────
const O   = '#D4601A'
const O10 = 'rgba(212,96,26,0.10)'
const O20 = 'rgba(212,96,26,0.20)'
const T   = '#1C0F06'
const T5  = 'rgba(80,35,8,0.58)'
const T3  = 'rgba(80,35,8,0.32)'
const BG  = '#FAF5EB'
const WHITE = '#FFFFFF'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Note {
  id: string
  content: string
  property_id: string | null
  created_at: string
}

interface Contact {
  id: string
  type: 'tenant' | 'prospect'
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  status: 'active_tenant' | 'past_tenant' | 'prospect'
  source: string | null
  property_id: string | null
  property_address: string | null
  contract_id: string | null
  contract_start: string | null
  contract_end: string | null
  monthly_rent: number | null
  total_paid: number
  notes: Note[]
  created_at: string
}

interface CRMStats {
  total_contacts: number
  active_tenants: number
  past_tenants: number
  prospects: number
  properties_count: number
  total_views: number
  total_leads: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  active_tenant: 'Locataire actif',
  past_tenant: 'Ancien locataire',
  prospect: 'Prospect',
}
const STATUS_COLOR: Record<string, string> = {
  active_tenant: '#3B6D11',
  past_tenant: '#854F0B',
  prospect: '#185FA5',
}
const STATUS_BG: Record<string, string> = {
  active_tenant: 'rgba(59,109,17,0.10)',
  past_tenant: 'rgba(133,79,11,0.10)',
  prospect: 'rgba(24,95,165,0.10)',
}

function initials(c: Contact) {
  const f = c.first_name?.[0] ?? ''
  const l = c.last_name?.[0] ?? ''
  return (f + l).toUpperCase() || '?'
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtCHF(n: number) {
  return `CHF ${n.toLocaleString('fr-CH')}`
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{ background: WHITE, border: `0.5px solid ${O20}`, borderRadius: 14, padding: '16px 20px', flex: 1 }}>
      <div style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: T3, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 300, color: O, fontFamily: 'var(--font-serif)', letterSpacing: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T3, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CRMPage() {
  const [stats, setStats] = useState<CRMStats | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'active_tenant' | 'past_tenant' | 'prospect'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Contact | null>(null)
  const [noteInput, setNoteInput] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)
  const [showAddProspect, setShowAddProspect] = useState(false)
  const [prospectForm, setProspectForm] = useState({ first_name: '', last_name: '', email: '', phone: '', source: 'manual' })
  const [prospectLoading, setProspectLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, contactsRes] = await Promise.all([
        api.get<CRMStats>('/crm/stats'),
        api.get<Contact[]>('/crm/contacts'),
      ])
      setStats(statsRes.data)
      setContacts(contactsRes.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Refresh selected contact après ajout de note
  const refreshContact = useCallback((updated: Contact) => {
    setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
    setSelected(updated)
  }, [])

  const filtered = contacts.filter(c => {
    if (tab !== 'all' && c.status !== tab) return false
    if (search) {
      const s = search.toLowerCase()
      const full = `${c.first_name ?? ''} ${c.last_name ?? ''} ${c.email ?? ''} ${c.property_address ?? ''}`.toLowerCase()
      if (!full.includes(s)) return false
    }
    return true
  })

  async function addNote() {
    if (!selected || !noteInput.trim()) return
    setNoteLoading(true)
    try {
      await api.post('/crm/notes', {
        content: noteInput.trim(),
        target_type: selected.type === 'tenant' ? 'tenant' : 'prospect',
        target_id: selected.id,
        property_id: selected.property_id,
      })
      setNoteInput('')
      // Recharger les contacts pour mettre à jour les notes
      const res = await api.get<Contact[]>('/crm/contacts')
      setContacts(res.data)
      const updated = res.data.find(c => c.id === selected.id)
      if (updated) setSelected(updated)
    } catch { /* ignore */ }
    finally { setNoteLoading(false) }
  }

  async function deleteNote(noteId: string) {
    try {
      await api.delete(`/crm/notes/${noteId}`)
      const res = await api.get<Contact[]>('/crm/contacts')
      setContacts(res.data)
      const updated = res.data.find(c => c.id === selected?.id)
      if (updated) setSelected(updated)
    } catch { /* ignore */ }
  }

  async function addProspect() {
    setProspectLoading(true)
    try {
      await api.post('/crm/contacts', { ...prospectForm })
      setShowAddProspect(false)
      setProspectForm({ first_name: '', last_name: '', email: '', phone: '', source: 'manual' })
      await load()
    } catch { /* ignore */ }
    finally { setProspectLoading(false) }
  }

  async function deleteProspect(id: string) {
    if (!confirm('Supprimer ce prospect ?')) return
    try {
      await api.delete(`/crm/contacts/${id}`)
      setSelected(null)
      await load()
    } catch { /* ignore */ }
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: 'var(--font-sans)' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 300, color: T, letterSpacing: '0.5px', marginBottom: 4 }}>CRM</h1>
        <p style={{ fontSize: 13, color: T3 }}>Locataires, anciens locataires et prospects — vue d'ensemble.</p>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <StatCard label="Total contacts" value={stats.total_contacts} />
          <StatCard label="Locataires actifs" value={stats.active_tenants} />
          <StatCard label="Anciens locataires" value={stats.past_tenants} />
          <StatCard label="Prospects" value={stats.prospects} />
          <StatCard label="Vues listing" value={stats.total_views.toLocaleString('fr-CH')} sub={`${stats.total_leads} leads`} />
        </div>
      )}

      {/* ── Tabs + Search + Add ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'active_tenant', 'past_tenant', 'prospect'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit', border: `0.5px solid ${tab === t ? O : O20}`,
                background: tab === t ? O : 'transparent',
                color: tab === t ? '#fff' : T5,
              }}
            >
              {t === 'all' ? 'Tous' : STATUS_LABEL[t]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            style={{ padding: '7px 14px', borderRadius: 20, border: `0.5px solid ${O20}`, background: WHITE, fontSize: 12, color: T, outline: 'none', fontFamily: 'inherit', width: 200 }}
          />
          <button
            onClick={() => setShowAddProspect(true)}
            style={{ padding: '7px 16px', borderRadius: 20, background: O, color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            + Prospect
          </button>
        </div>
      </div>

      {/* ── Main layout : liste + détail ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* Liste */}
        <div style={{ flex: selected ? '0 0 340px' : 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 76, background: WHITE, borderRadius: 14, border: `0.5px solid ${O20}`, animation: 'pulse 1.5s infinite' }} />
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: T3, fontSize: 13 }}>
              Aucun contact{search ? ' pour cette recherche' : ''}.
            </div>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onClick={() => setSelected(selected?.id === c.id ? null : c)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  background: selected?.id === c.id ? O10 : WHITE,
                  border: `0.5px solid ${selected?.id === c.id ? O : O20}`,
                  borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
                  fontFamily: 'inherit',
                }}
              >
                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: O10, border: `1px solid ${O20}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: O, flexShrink: 0 }}>
                  {initials(c)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: T, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.first_name} {c.last_name}
                    </span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: STATUS_BG[c.status], color: STATUS_COLOR[c.status], flexShrink: 0 }}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: T3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.property_address ?? c.email ?? '—'}
                  </div>
                </div>
                {c.notes.length > 0 && (
                  <div style={{ fontSize: 10, color: T3, flexShrink: 0 }}>
                    📝 {c.notes.length}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* ── Panel détail ── */}
        {selected && (
          <div style={{ flex: 1, background: WHITE, border: `0.5px solid ${O20}`, borderRadius: 16, padding: '24px', minWidth: 0 }}>

            {/* En-tête contact */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: O10, border: `1px solid ${O20}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 500, color: O }}>
                  {initials(selected)}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 500, color: T, marginBottom: 4 }}>
                    {selected.first_name} {selected.last_name}
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: STATUS_BG[selected.status], color: STATUS_COLOR[selected.status] }}>
                    {STATUS_LABEL[selected.status]}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {selected.type === 'prospect' && (
                  <button
                    onClick={() => deleteProspect(selected.id)}
                    style={{ padding: '6px 12px', borderRadius: 20, border: `0.5px solid rgba(163,45,45,0.3)`, background: 'rgba(163,45,45,0.06)', color: '#A32D2D', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Supprimer
                  </button>
                )}
                <button
                  onClick={() => setSelected(null)}
                  style={{ padding: '6px 12px', borderRadius: 20, border: `0.5px solid ${O20}`, background: 'transparent', color: T5, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Infos contact */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1.5rem' }}>
              {[
                { label: 'Email', value: selected.email },
                { label: 'Téléphone', value: selected.phone },
                { label: 'Bien', value: selected.property_address },
                { label: 'Source', value: selected.source ? { manual: 'Manuel', inquiry: 'Demande', portal: 'Portail', referral: 'Recommandation' }[selected.source] ?? selected.source : null },
              ].map(({ label, value }) => value ? (
                <div key={label} style={{ background: BG, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: T3, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, color: T }}>{value}</div>
                </div>
              ) : null)}
            </div>

            {/* Bail / Finances (locataires seulement) */}
            {selected.type === 'tenant' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: '1.5rem' }}>
                <div style={{ background: BG, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: T3, marginBottom: 3 }}>Début bail</div>
                  <div style={{ fontSize: 13, color: T }}>{fmtDate(selected.contract_start)}</div>
                </div>
                <div style={{ background: BG, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: T3, marginBottom: 3 }}>Fin bail</div>
                  <div style={{ fontSize: 13, color: T }}>{fmtDate(selected.contract_end)}</div>
                </div>
                <div style={{ background: BG, borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: T3, marginBottom: 3 }}>Loyer/mois</div>
                  <div style={{ fontSize: 13, color: O, fontWeight: 500 }}>
                    {selected.monthly_rent ? fmtCHF(selected.monthly_rent) : '—'}
                  </div>
                </div>
                {selected.total_paid > 0 && (
                  <div style={{ background: 'rgba(59,109,17,0.06)', border: '0.5px solid rgba(59,109,17,0.2)', borderRadius: 10, padding: '10px 14px', gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: '#3B6D11', marginBottom: 3 }}>Total loyers encaissés</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: '#3B6D11', fontFamily: 'var(--font-serif)' }}>{fmtCHF(selected.total_paid)}</div>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div style={{ borderTop: `0.5px solid ${O20}`, paddingTop: '1.5rem' }}>
              <div style={{ fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', color: T3, marginBottom: '1rem' }}>
                Notes ({selected.notes.length})
              </div>

              {selected.notes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
                  {selected.notes.map(note => (
                    <div key={note.id} style={{ background: BG, borderRadius: 10, padding: '12px 14px', position: 'relative' }}>
                      <div style={{ fontSize: 13, color: T, lineHeight: 1.5, marginBottom: 6, whiteSpace: 'pre-wrap' }}>{note.content}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: T3 }}>{fmtDate(note.created_at)}</span>
                        <button
                          onClick={() => deleteNote(note.id)}
                          style={{ fontSize: 10, color: 'rgba(163,45,45,0.7)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: T3, marginBottom: '1rem' }}>Aucune note pour le moment.</p>
              )}

              {/* Ajouter une note */}
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="Ajouter une note…"
                  rows={2}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 12, border: `0.5px solid ${O20}`, background: BG, fontSize: 13, color: T, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
                />
                <button
                  onClick={addNote}
                  disabled={noteLoading || !noteInput.trim()}
                  style={{ padding: '0 18px', borderRadius: 12, background: O, color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', opacity: (noteLoading || !noteInput.trim()) ? 0.5 : 1, alignSelf: 'flex-end', height: 40 }}
                >
                  {noteLoading ? '…' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal : Ajouter prospect ── */}
      {showAddProspect && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,15,6,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
          <div style={{ background: WHITE, borderRadius: 20, padding: '28px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(28,15,6,0.15)' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 300, color: T, marginBottom: '1.2rem' }}>Nouveau prospect</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, color: T3, letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Prénom</label>
                  <input value={prospectForm.first_name} onChange={e => setProspectForm(f => ({ ...f, first_name: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: `0.5px solid ${O20}`, fontSize: 13, color: T, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: T3, letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Nom</label>
                  <input value={prospectForm.last_name} onChange={e => setProspectForm(f => ({ ...f, last_name: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: `0.5px solid ${O20}`, fontSize: 13, color: T, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: T3, letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Email</label>
                <input type="email" value={prospectForm.email} onChange={e => setProspectForm(f => ({ ...f, email: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: `0.5px solid ${O20}`, fontSize: 13, color: T, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: T3, letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Téléphone</label>
                <input type="tel" value={prospectForm.phone} onChange={e => setProspectForm(f => ({ ...f, phone: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: `0.5px solid ${O20}`, fontSize: 13, color: T, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: T3, letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Source</label>
                <select value={prospectForm.source} onChange={e => setProspectForm(f => ({ ...f, source: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: `0.5px solid ${O20}`, fontSize: 13, color: T, fontFamily: 'inherit', outline: 'none', background: WHITE, boxSizing: 'border-box' }}>
                  <option value="manual">Manuel</option>
                  <option value="inquiry">Demande entrante</option>
                  <option value="portal">Portail (Airbnb, etc.)</option>
                  <option value="referral">Recommandation</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: '1.5rem' }}>
              <button onClick={() => setShowAddProspect(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 12, border: `0.5px solid ${O20}`, background: 'transparent', color: T5, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={addProspect} disabled={prospectLoading}
                style={{ flex: 1, padding: '10px', borderRadius: 12, background: O, color: '#fff', border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: prospectLoading ? 0.6 : 1 }}>
                {prospectLoading ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
