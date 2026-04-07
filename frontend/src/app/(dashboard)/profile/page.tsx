'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useUser } from '@/lib/auth'

interface ProfileFormData {
  first_name: string
  last_name: string
  phone: string
  iban: string
  bic: string
  bank_account_holder: string
}

export default function ProfilePage() {
  const { data: profile, refetch } = useUser()
  const [form, setForm] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    phone: '',
    iban: '',
    bic: '',
    bank_account_holder: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        phone: profile.phone ?? '',
        iban: profile.iban ?? '',
        bic: profile.bic ?? '',
        bank_account_holder: profile.bank_account_holder ?? '',
      })
    }
  }, [profile])

  function set(field: keyof ProfileFormData, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setSaved(false)
    setError('')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await api.patch('/auth/profile', {
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        phone: form.phone || null,
        iban: form.iban || null,
        bic: form.bic || null,
        bank_account_holder: form.bank_account_holder || null,
      })
      await refetch?.()
      setSaved(true)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const O = '#D4601A'
  const T = '#1C0F06'
  const T5 = 'rgba(80,35,8,0.55)'
  const border = '0.5px solid rgba(160,92,40,0.2)'

  function Field({ label, value, field, placeholder, type = 'text' }: {
    label: string; value: string; field: keyof ProfileFormData; placeholder?: string; type?: string
  }) {
    return (
      <div>
        <label style={{ display: 'block', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: T5, marginBottom: 6 }}>{label}</label>
        <input
          type={type}
          value={value}
          onChange={e => set(field, e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', padding: '10px 14px', border, borderRadius: 10, fontSize: 14, color: T, background: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '1.5rem 0' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 300, color: O, letterSpacing: 2, marginBottom: '0.5rem' }}>Mon profil</h1>
      <p style={{ fontSize: 12, color: T5, marginBottom: '2rem' }}>{profile?.email}</p>

      {/* Identité */}
      <section style={{ background: '#fff', borderRadius: 16, padding: '20px', border, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T5, marginBottom: 2 }}>Identité</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Prénom" field="first_name" value={form.first_name} placeholder="Jean" />
          <Field label="Nom" field="last_name" value={form.last_name} placeholder="Dupont" />
        </div>
        <Field label="Téléphone" field="phone" value={form.phone} placeholder="+41 79 000 00 00" />
      </section>

      {/* Coordonnées bancaires */}
      <section style={{ background: '#fff', borderRadius: 16, padding: '20px', border, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <p style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T5, margin: 0 }}>Coordonnées bancaires</p>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(212,96,26,0.07)', color: O, border: '0.5px solid rgba(212,96,26,0.2)' }}>Pour virements loyer</span>
        </div>
        <Field label="Titulaire du compte" field="bank_account_holder" value={form.bank_account_holder} placeholder="Jean Dupont" />
        <Field label="IBAN" field="iban" value={form.iban} placeholder="CH56 0483 5012 3456 7800 9" />
        <Field label="BIC / SWIFT" field="bic" value={form.bic} placeholder="CRESCHZZ80A" />
        <p style={{ fontSize: 11, color: 'rgba(80,35,8,0.35)', marginTop: -4 }}>
          Ces informations permettent aux locataires de vous virer directement le loyer.
        </p>
      </section>

      {error && <p style={{ fontSize: 12, color: '#A32D2D', marginBottom: 10 }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: saving ? 'rgba(212,96,26,0.5)' : O, border: 'none', color: '#fff', fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' }}
      >
        {saving ? 'Sauvegarde…' : saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
      </button>
    </div>
  )
}
