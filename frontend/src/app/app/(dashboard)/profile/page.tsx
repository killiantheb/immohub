'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useUser } from '@/lib/auth'

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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: `1px solid ${S.border}`,
    borderRadius: 10,
    fontSize: 14,
    color: S.text,
    background: S.surface,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: S.text3,
    marginBottom: 6,
    fontWeight: 500,
  }

  function Field({ label, value, field, placeholder, type = 'text' }: {
    label: string; value: string; field: keyof ProfileFormData; placeholder?: string; type?: string
  }) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <input
          type={type}
          value={value}
          onChange={e => set(field, e.target.value)}
          placeholder={placeholder}
          style={inputStyle}
        />
      </div>
    )
  }

  const cardStyle: React.CSSProperties = {
    background: S.surface,
    border: `1px solid ${S.border}`,
    borderRadius: 14,
    boxShadow: S.shadow,
    padding: 20,
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '1.5rem 0' }}>
      <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontSize: 28, fontWeight: 400, color: S.text, letterSpacing: 1, marginBottom: '0.5rem' }}>
        Mon profil
      </h1>
      <p style={{ fontSize: 13, color: S.text3, marginBottom: '2rem' }}>{profile?.email}</p>

      {/* Identité */}
      <section style={cardStyle}>
        <p style={{ fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: S.text3, marginBottom: 2 }}>Identité</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Prénom" field="first_name" value={form.first_name} placeholder="Jean" />
          <Field label="Nom" field="last_name" value={form.last_name} placeholder="Dupont" />
        </div>
        <Field label="Téléphone" field="phone" value={form.phone} placeholder="+41 79 000 00 00" />
      </section>

      {/* Coordonnées bancaires */}
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <p style={{ fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: S.text3, margin: 0 }}>Coordonnées bancaires</p>
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: S.orangeBg, color: S.orange, border: `1px solid ${S.orange}` }}>Pour virements loyer</span>
        </div>
        <Field label="Titulaire du compte" field="bank_account_holder" value={form.bank_account_holder} placeholder="Jean Dupont" />
        <Field label="IBAN" field="iban" value={form.iban} placeholder="CH56 0483 5012 3456 7800 9" />
        <Field label="BIC / SWIFT" field="bic" value={form.bic} placeholder="CRESCHZZ80A" />
        <p style={{ fontSize: 11, color: S.text3, marginTop: -4 }}>
          Ces informations permettent aux locataires de vous virer directement le loyer.
        </p>
      </section>

      {error && <p style={{ fontSize: 12, color: S.red, marginBottom: 10 }}>{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%',
          padding: '12px 0',
          borderRadius: 12,
          background: saving ? S.orangeBg : S.orange,
          border: 'none',
          color: saving ? S.orange : '#fff',
          fontSize: 14,
          fontWeight: 500,
          cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'opacity 0.15s',
        }}
      >
        {saving ? 'Sauvegarde…' : saved ? 'Sauvegarde' : 'Sauvegarder'}
      </button>
    </div>
  )
}
