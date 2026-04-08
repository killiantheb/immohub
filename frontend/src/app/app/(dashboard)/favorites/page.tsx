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

interface Favorite {
  id: string
  property_id: string
  notes: string | null
  created_at: string
  property_address: string | null
  property_city: string | null
  property_type: string | null
  monthly_rent: number | null
  rooms: number | null
  surface: number | null
  property_status: string | null
}

const TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement', villa: 'Villa', parking: 'Parking',
  garage: 'Garage', box: 'Box', cave: 'Cave', depot: 'Dépôt',
  office: 'Bureau', commercial: 'Commercial', hotel: 'Hôtel',
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  available:   { label: 'Disponible', color: S.green,  bg: S.greenBg },
  rented:      { label: 'Loué',       color: S.amber,  bg: S.amberBg },
  for_sale:    { label: 'À vendre',   color: S.orange, bg: S.orangeBg },
  sold:        { label: 'Vendu',      color: S.text3,  bg: S.surface2 },
  maintenance: { label: 'En travaux', color: S.red,    bg: S.redBg },
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [editNotes, setEditNotes] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api.get('/favorites/')
      .then(r => setFavorites(r.data))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  async function removeFavorite(id: string) {
    await api.delete(`/favorites/${id}`)
    setFavorites(f => f.filter(x => x.id !== id))
  }

  async function saveNotes(id: string) {
    setSaving(s => ({ ...s, [id]: true }))
    try {
      await api.patch(`/favorites/${id}/notes`, { notes: editNotes[id] ?? '' })
      setFavorites(f => f.map(x => x.id === id ? { ...x, notes: editNotes[id] ?? null } : x))
      setEditNotes(n => { const next = { ...n }; delete next[id]; return next })
    } finally {
      setSaving(s => ({ ...s, [id]: false }))
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '3rem', color: S.text3, fontSize: 13 }}>Chargement…</div>
  }

  const cardStyle: React.CSSProperties = {
    background: S.surface,
    border: `1px solid ${S.border}`,
    borderRadius: 14,
    boxShadow: S.shadow,
    padding: 20,
    marginBottom: 12,
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1.5rem 0' }}>
      <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontSize: 28, fontWeight: 400, color: S.text, letterSpacing: 1, marginBottom: '0.5rem' }}>
        Mes favoris
      </h1>
      <p style={{ fontSize: 13, color: S.text3, marginBottom: '1.5rem' }}>
        {favorites.length} bien{favorites.length !== 1 ? 's' : ''} sauvegardé{favorites.length !== 1 ? 's' : ''}
      </p>

      {favorites.length === 0 ? (
        <div style={{ ...cardStyle, padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: S.text, marginBottom: 8 }}>Aucun favori pour l'instant</p>
          <p style={{ fontSize: 13, color: S.text3 }}>Ajoutez des biens depuis la liste des propriétés pour les retrouver ici.</p>
        </div>
      ) : (
        favorites.map(fav => {
          const st = fav.property_status ? STATUS_LABELS[fav.property_status] : null
          const isEditing = fav.id in editNotes
          return (
            <div key={fav.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: S.text }}>
                      {fav.property_address ?? 'Adresse inconnue'}
                    </p>
                    {st && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 500 }}>
                        {st.label}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: S.text3 }}>
                    {fav.property_city ?? ''}{fav.property_type ? ` — ${TYPE_LABELS[fav.property_type] ?? fav.property_type}` : ''}
                    {fav.rooms ? ` — ${fav.rooms} p.` : ''}
                    {fav.surface ? ` — ${fav.surface} m²` : ''}
                  </p>
                </div>
                <button
                  onClick={() => removeFavorite(fav.id)}
                  style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.red, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 8, flexShrink: 0 }}
                >
                  Retirer
                </button>
              </div>

              {fav.monthly_rent && (
                <p style={{ fontSize: 18, fontWeight: 700, color: S.orange, marginBottom: 12 }}>
                  {fav.monthly_rent.toLocaleString('fr-CH', { minimumFractionDigits: 2 })} CHF/mois
                </p>
              )}

              {/* Notes */}
              {isEditing ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <textarea
                    value={editNotes[fav.id]}
                    onChange={e => setEditNotes(n => ({ ...n, [fav.id]: e.target.value }))}
                    placeholder="Notes personnelles…"
                    rows={2}
                    style={{ flex: 1, padding: '8px 12px', border: `1px solid ${S.border}`, borderRadius: 10, fontSize: 13, color: S.text, background: S.surface2, fontFamily: 'inherit', resize: 'none', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      onClick={() => saveNotes(fav.id)}
                      disabled={saving[fav.id]}
                      style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: S.orange, color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {saving[fav.id] ? '…' : 'Sauv.'}
                    </button>
                    <button
                      onClick={() => setEditNotes(n => { const next = { ...n }; delete next[fav.id]; return next })}
                      style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.text3, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditNotes(n => ({ ...n, [fav.id]: fav.notes ?? '' }))}
                  style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 10, background: fav.notes ? S.orangeBg : 'transparent', border: fav.notes ? `1px solid ${S.orange}` : `1px dashed ${S.border}`, minHeight: 36, display: 'flex', alignItems: 'center' }}
                >
                  <p style={{ fontSize: 13, color: fav.notes ? S.text2 : S.text3, fontStyle: fav.notes ? 'normal' : 'italic' }}>
                    {fav.notes ?? 'Ajouter une note…'}
                  </p>
                </div>
              )}

              <p style={{ fontSize: 10, color: S.text3, marginTop: 10 }}>
                Ajouté le {new Date(fav.created_at).toLocaleDateString('fr-CH')}
              </p>
            </div>
          )
        })
      )}
    </div>
  )
}
