'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const O = '#D4601A'
const T = '#1C0F06'
const T5 = 'rgba(80,35,8,0.55)'
const T3 = 'rgba(80,35,8,0.30)'
const border = '0.5px solid rgba(160,92,40,0.2)'

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  available: { label: 'Disponible', color: '#16a34a' },
  rented: { label: 'Loué', color: '#ca8a04' },
  for_sale: { label: 'À vendre', color: O },
  sold: { label: 'Vendu', color: '#64748b' },
  maintenance: { label: 'En travaux', color: '#dc2626' },
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
    return <div style={{ textAlign: 'center', padding: '3rem', color: T5, fontSize: 13 }}>Chargement…</div>
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1.5rem 0' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 300, color: O, letterSpacing: 2, marginBottom: '0.5rem' }}>
        Mes favoris
      </h1>
      <p style={{ fontSize: 12, color: T5, marginBottom: '1.5rem' }}>
        {favorites.length} bien{favorites.length !== 1 ? 's' : ''} sauvegardé{favorites.length !== 1 ? 's' : ''}
      </p>

      {favorites.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 16, padding: '40px 24px', border, textAlign: 'center' }}>
          <p style={{ fontSize: 32, marginBottom: 12 }}>❤️</p>
          <p style={{ fontSize: 15, color: T, marginBottom: 8 }}>Aucun favori pour l'instant</p>
          <p style={{ fontSize: 13, color: T5 }}>Ajoutez des biens depuis la liste des propriétés pour les retrouver ici.</p>
        </div>
      ) : (
        favorites.map(fav => {
          const st = fav.property_status ? STATUS_LABELS[fav.property_status] : null
          const isEditing = fav.id in editNotes
          return (
            <div key={fav.id} style={{ background: '#fff', borderRadius: 16, padding: '20px', border, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: T }}>
                      {fav.property_address ?? 'Adresse inconnue'}
                    </p>
                    {st && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${st.color}15`, color: st.color, fontWeight: 500 }}>
                        {st.label}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: T5 }}>
                    {fav.property_city ?? ''}{fav.property_type ? ` — ${TYPE_LABELS[fav.property_type] ?? fav.property_type}` : ''}
                    {fav.rooms ? ` — ${fav.rooms} p.` : ''}
                    {fav.surface ? ` — ${fav.surface} m²` : ''}
                  </p>
                </div>
                <button
                  onClick={() => removeFavorite(fav.id)}
                  style={{ padding: '4px 8px', borderRadius: 8, border, background: 'transparent', color: '#dc2626', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 8, flexShrink: 0 }}
                >
                  Retirer
                </button>
              </div>

              {fav.monthly_rent && (
                <p style={{ fontSize: 18, fontWeight: 700, color: O, marginBottom: 12 }}>
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
                    style={{ flex: 1, padding: '8px 12px', border, borderRadius: 10, fontSize: 13, color: T, background: '#fafafa', fontFamily: 'inherit', resize: 'none', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      onClick={() => saveNotes(fav.id)}
                      disabled={saving[fav.id]}
                      style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: O, color: '#fff', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {saving[fav.id] ? '…' : 'Sauv.'}
                    </button>
                    <button
                      onClick={() => setEditNotes(n => { const next = { ...n }; delete next[fav.id]; return next })}
                      style={{ padding: '6px 12px', borderRadius: 8, border, background: 'transparent', color: T5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditNotes(n => ({ ...n, [fav.id]: fav.notes ?? '' }))}
                  style={{ cursor: 'pointer', padding: '8px 12px', borderRadius: 10, background: fav.notes ? 'rgba(212,96,26,0.04)' : 'transparent', border: fav.notes ? '0.5px solid rgba(212,96,26,0.15)' : '0.5px dashed rgba(160,92,40,0.2)', minHeight: 36, display: 'flex', alignItems: 'center' }}
                >
                  <p style={{ fontSize: 13, color: fav.notes ? T5 : T3, fontStyle: fav.notes ? 'normal' : 'italic' }}>
                    {fav.notes ?? 'Ajouter une note…'}
                  </p>
                </div>
              )}

              <p style={{ fontSize: 10, color: T3, marginTop: 10 }}>
                Ajouté le {new Date(fav.created_at).toLocaleDateString('fr-CH')}
              </p>
            </div>
          )
        })
      )}
    </div>
  )
}
