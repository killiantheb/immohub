'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

const O = '#D4601A'
const T = '#1C0F06'
const T5 = 'rgba(80,35,8,0.55)'
const T3 = 'rgba(80,35,8,0.30)'
const border = '0.5px solid rgba(160,92,40,0.2)'

interface Settings {
  user_id: string
  commission_location_pct: number
  commission_management_pct: number
  commission_sale_pct: number
  deposit_months: number
  default_contract_type: string
  default_notice_months: number
  default_included_charges: boolean
  agency_name: string | null
  agency_address: string | null
  agency_phone: string | null
  agency_email: string | null
  agency_rc_number: string | null
  agency_da_number: string | null
  agency_website: string | null
  agency_description: string | null
  notify_late_rent_days: number
  notify_expiry_days: number
  notify_via_email: boolean
  notify_via_whatsapp: boolean
  whatsapp_number: string | null
  ai_auto_actions: boolean
}

type SettingsForm = Omit<Settings, 'user_id'>

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: T5, marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '10px 14px', border, borderRadius: 10, fontSize: 13, color: T, background: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
      />
    </div>
  )
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <p style={{ fontSize: 13, color: T, margin: 0 }}>{label}</p>
        {hint && <p style={{ fontSize: 11, color: T3, marginTop: 2 }}>{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? O : 'rgba(160,92,40,0.2)',
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <span style={{
          position: 'absolute', top: 3, left: value ? 22 : 3, width: 18, height: 18,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/agency/settings')
      .then(r => setForm(r.data))
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [])

  function set<K extends keyof SettingsForm>(key: K, val: SettingsForm[K]) {
    setForm(f => f ? { ...f, [key]: val } : f)
    setSaved(false)
  }

  async function save() {
    if (!form) return
    setSaving(true)
    setError('')
    try {
      await api.put('/agency/settings', form)
      setSaved(true)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: T5, fontSize: 13 }}>Chargement…</div>
  if (!form) return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '3rem 0', textAlign: 'center' }}>
      <p style={{ color: '#dc2626', fontSize: 14 }}>Paramètres réservés aux agences et propriétaires.</p>
    </div>
  )

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <section style={{ background: '#fff', borderRadius: 16, padding: '20px', border, marginBottom: 12 }}>
        <p style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T5, marginBottom: 16 }}>{title}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      </section>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem 0' }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 300, color: O, letterSpacing: 2, marginBottom: '1.5rem' }}>
        Paramètres agence
      </h1>

      {/* Identité */}
      <Section title="Identité agence">
        <Field label="Nom de l'agence" value={form.agency_name ?? ''} onChange={v => set('agency_name', v)} placeholder="Immobilier Dupont SA" />
        <Field label="Adresse" value={form.agency_address ?? ''} onChange={v => set('agency_address', v)} placeholder="Rue de Lausanne 10, 1000 Lausanne" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Téléphone" value={form.agency_phone ?? ''} onChange={v => set('agency_phone', v)} placeholder="+41 21 000 00 00" />
          <Field label="Email" value={form.agency_email ?? ''} onChange={v => set('agency_email', v)} type="email" placeholder="contact@agence.ch" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="N° RC" value={form.agency_rc_number ?? ''} onChange={v => set('agency_rc_number', v)} placeholder="CHE-123.456.789" />
          <Field label="N° autorisation" value={form.agency_da_number ?? ''} onChange={v => set('agency_da_number', v)} placeholder="ADI-2024-001" />
        </div>
        <Field label="Site web" value={form.agency_website ?? ''} onChange={v => set('agency_website', v)} placeholder="https://www.agence.ch" />
      </Section>

      {/* Commissions */}
      <Section title="Commissions (%)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <Field
            label="Location"
            value={String(form.commission_location_pct)}
            onChange={v => set('commission_location_pct', parseFloat(v) || 0)}
            type="number"
            placeholder="8.33"
          />
          <Field
            label="Gérance"
            value={String(form.commission_management_pct)}
            onChange={v => set('commission_management_pct', parseFloat(v) || 0)}
            type="number"
            placeholder="5.0"
          />
          <Field
            label="Vente"
            value={String(form.commission_sale_pct)}
            onChange={v => set('commission_sale_pct', parseFloat(v) || 0)}
            type="number"
            placeholder="3.0"
          />
        </div>
        <p style={{ fontSize: 11, color: T3 }}>Standard suisse : 1 mois de loyer pour location, 5% gérance, 3% vente</p>
      </Section>

      {/* Contrat par défaut */}
      <Section title="Défauts contrat">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, letterSpacing: '1px', textTransform: 'uppercase', color: T5, marginBottom: 6 }}>Type de contrat</label>
            <select
              value={form.default_contract_type}
              onChange={e => set('default_contract_type', e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border, borderRadius: 10, fontSize: 13, color: T, background: '#fff', outline: 'none', fontFamily: 'inherit' }}
            >
              <option value="long_term">Long terme</option>
              <option value="seasonal">Saisonnier</option>
              <option value="short_term">Court terme</option>
              <option value="sale">Vente</option>
            </select>
          </div>
          <Field
            label="Préavis (mois)"
            value={String(form.default_notice_months)}
            onChange={v => set('default_notice_months', parseInt(v) || 3)}
            type="number"
            placeholder="3"
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field
            label="Caution (mois)"
            value={String(form.deposit_months)}
            onChange={v => set('deposit_months', Math.min(3, parseInt(v) || 3))}
            type="number"
            placeholder="3"
          />
          <div style={{ display: 'flex', alignItems: 'center', paddingTop: 24 }}>
            <Toggle
              label="Charges incluses"
              value={form.default_included_charges}
              onChange={v => set('default_included_charges', v)}
            />
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <Toggle
          label="Email"
          value={form.notify_via_email}
          onChange={v => set('notify_via_email', v)}
          hint="Recevoir les alertes par email"
        />
        <Toggle
          label="WhatsApp"
          value={form.notify_via_whatsapp}
          onChange={v => set('notify_via_whatsapp', v)}
          hint="Recevoir les alertes par WhatsApp"
        />
        {form.notify_via_whatsapp && (
          <Field label="Numéro WhatsApp" value={form.whatsapp_number ?? ''} onChange={v => set('whatsapp_number', v)} placeholder="+41 79 000 00 00" />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field
            label="Alerter loyer tardif (jours)"
            value={String(form.notify_late_rent_days)}
            onChange={v => set('notify_late_rent_days', parseInt(v) || 3)}
            type="number"
          />
          <Field
            label="Alerter expiration bail (jours)"
            value={String(form.notify_expiry_days)}
            onChange={v => set('notify_expiry_days', parseInt(v) || 60)}
            type="number"
          />
        </div>
      </Section>

      {/* IA */}
      <Section title="Intelligence artificielle">
        <Toggle
          label="Actions IA automatiques"
          value={form.ai_auto_actions}
          onChange={v => set('ai_auto_actions', v)}
          hint="Si activé, Althy peut agir sans demander de validation humaine. Déconseillé."
        />
      </Section>

      {error && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: saving ? 'rgba(212,96,26,0.5)' : O, border: 'none', color: '#fff', fontSize: 14, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
      >
        {saving ? 'Sauvegarde…' : saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
      </button>
    </div>
  )
}
