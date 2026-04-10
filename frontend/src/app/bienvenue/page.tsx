'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { AlthySphereCore } from '@/components/sphere/AlthySphereCore'
import { api, baseURL } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import { useUser } from '@/lib/auth'
import type { SphereState } from '@/lib/store/sphereStore'

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'proprio_solo' | 'agence' | 'opener' | 'artisan' | 'hunter' | 'locataire'
type StepId = 1 | 2 | 3 | 4 | 5

interface Question {
  id: string
  label: string
  type: 'number' | 'text' | 'select'
  options?: string[]
  placeholder?: string
  optional?: boolean
}

// ── Static data ───────────────────────────────────────────────────────────────

const ROLES: { id: Role; icon: string; label: string; desc: string }[] = [
  { id: 'proprio_solo', icon: '🏠', label: 'Propriétaire',  desc: 'Gérez vos biens simplement, avec ou sans agence' },
  { id: 'agence',       icon: '🏢', label: 'Agence',         desc: 'Équipez votre équipe et servez mieux vos clients' },
  { id: 'opener',       icon: '🗝️', label: 'Ouvreur',        desc: 'Recevez des missions, gérez votre activité' },
  { id: 'artisan',      icon: '🔧', label: 'Artisan',        desc: 'Trouvez des chantiers, facturez facilement' },
  { id: 'hunter',       icon: '🎯', label: 'Hunter',         desc: 'Signalez des biens off-market, soyez rémunéré' },
  { id: 'locataire',    icon: '📋', label: 'Locataire',      desc: 'Vos documents et demandes en un clic, gratuit' },
]

const ROLE_QUESTIONS: Record<Role, Question[]> = {
  proprio_solo: [
    { id: 'nb_biens',  label: 'Combien de biens possédez-vous ?', type: 'number', placeholder: '3' },
    { id: 'gestion',   label: 'Gérez-vous seul ou avec une agence ?', type: 'select', options: ['Seul', 'Avec une agence', 'Les deux'] },
  ],
  agence: [
    { id: 'nb_agents',  label: "Combien d'agents dans votre équipe ?", type: 'number', placeholder: '5' },
    { id: 'specialite', label: 'Votre domaine principal ?', type: 'select', options: ['Location', 'Vente', 'Gérance', 'PPE', 'Tout'] },
  ],
  opener: [
    { id: 'canton',        label: 'Votre canton principal ?', type: 'text', placeholder: 'Genève, Vaud…' },
    { id: 'dispo_semaine', label: 'Disponibilité par semaine ?', type: 'select', options: ['< 10h', '10–20h', '20–40h', 'Temps plein'] },
  ],
  artisan: [
    { id: 'metier', label: 'Votre métier principal ?', type: 'select', options: ['Plombier', 'Électricien', 'Peintre', 'Menuisier', 'Maçon', 'Autre'] },
    { id: 'canton', label: 'Votre canton ?', type: 'text', placeholder: 'Genève, Vaud…' },
  ],
  hunter: [
    { id: 'secteur',    label: 'Votre secteur géographique ?', type: 'text', placeholder: 'Ex: Lausanne, Morges…' },
    { id: 'type_biens', label: 'Type de biens ciblés ?', type: 'select', options: ['Résidentiel', 'Commercial', 'Terrain', 'Tous'] },
  ],
  locataire: [
    { id: 'recherche', label: 'Cherchez-vous un logement ?', type: 'select', options: ['Oui, activement', 'Oui, sans urgence', "J'occupe déjà un logement"] },
    { id: 'budget',    label: 'Budget loyer mensuel ?', type: 'select', options: ["< CHF 1'000", "CHF 1'000–2'000", "CHF 2'000–3'000", "> CHF 3'000"], optional: true },
  ],
}

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement' },
  { value: 'villa',     label: 'Villa / Maison' },
  { value: 'studio',    label: 'Studio' },
  { value: 'office',    label: 'Bureau / Commerce' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function patchProfile(role: string, data: Record<string, unknown>) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''
    await fetch(`${baseURL}/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...data, role, onboarding_completed: true }),
    })
    await supabase.auth.updateUser({ data: { onboarding_completed: true } })
  } catch (e) { console.error('onboarding patch error', e) }
}

// ── Input helpers ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', border: '1px solid var(--althy-border)',
  borderRadius: 10, fontSize: 14, background: 'var(--althy-bg)', color: 'var(--althy-text)',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

// ── Step 1 — Role selection ───────────────────────────────────────────────────

function Step1Role({ role, setRole }: { role: Role | null; setRole: (r: Role) => void }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: 'var(--althy-text)', margin: '0 0 8px' }}>
        Je suis…
      </h2>
      <p style={{ fontSize: 13, color: 'var(--althy-text-3)', margin: '0 0 24px' }}>
        Choisissez votre rôle principal — vous pourrez en ajouter d&apos;autres plus tard.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {ROLES.map((r) => {
          const selected = role === r.id
          return (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              style={{
                padding: '18px 16px', borderRadius: 14, textAlign: 'left', cursor: 'pointer',
                background: selected ? 'var(--althy-orange-bg, rgba(232,96,44,0.08))' : 'var(--althy-surface)',
                border: selected ? '2px solid var(--althy-orange)' : '1px solid var(--althy-border)',
                boxShadow: selected ? '0 2px 12px rgba(232,96,44,0.12)' : '0 1px 4px rgba(26,22,18,0.04)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>{r.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--althy-text)', marginBottom: 4 }}>{r.label}</div>
              <div style={{ fontSize: 12, color: 'var(--althy-text-3)', lineHeight: 1.4 }}>{r.desc}</div>
              {selected && <CheckCircle2 size={16} color="var(--althy-orange)" style={{ marginTop: 8 }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 2 — Quick questions ──────────────────────────────────────────────────

function Step2Questions({ role, questions, answers, setAnswers }: {
  role: Role
  questions: Question[]
  answers: Record<string, string>
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>
}) {
  const roleData = ROLES.find(r => r.id === role)!
  return (
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: 'var(--althy-orange-bg, rgba(232,96,44,0.08))', border: '1px solid rgba(232,96,44,0.2)', marginBottom: 20 }}>
        <span style={{ fontSize: 16 }}>{roleData.icon}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--althy-orange)' }}>{roleData.label}</span>
      </div>
      <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 300, color: 'var(--althy-text)', margin: '0 0 8px' }}>
        Quelques questions rapides
      </h2>
      <p style={{ fontSize: 13, color: 'var(--althy-text-3)', margin: '0 0 24px' }}>
        Pour personaliser votre expérience dès le départ.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {questions.map((q) => (
          <div key={q.id}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--althy-text)', marginBottom: 8 }}>
              {q.label}
              {q.optional && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--althy-text-3)', marginLeft: 6 }}>(optionnel)</span>}
            </label>
            {q.type === 'select' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {q.options!.map(opt => (
                  <button
                    key={opt}
                    onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                      background: answers[q.id] === opt ? 'var(--althy-orange)' : 'var(--althy-surface)',
                      color: answers[q.id] === opt ? '#fff' : 'var(--althy-text)',
                      border: answers[q.id] === opt ? '1px solid var(--althy-orange)' : '1px solid var(--althy-border)',
                      fontFamily: 'inherit', transition: 'all 0.15s',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type={q.type}
                value={answers[q.id] ?? ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder={q.placeholder}
                style={inputStyle}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step 3 — Premier bien ou zone ─────────────────────────────────────────────

function Step3Bien({ bien, setBien }: {
  bien: { adresse: string; ville: string; type: string }
  setBien: React.Dispatch<React.SetStateAction<{ adresse: string; ville: string; type: string }>>
}) {
  return (
    <div>
      <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 300, color: 'var(--althy-text)', margin: '0 0 8px' }}>
        Votre premier bien ou zone
      </h2>
      <p style={{ fontSize: 13, color: 'var(--althy-text-3)', margin: '0 0 24px' }}>
        Ajoutez un bien ou une zone pour qu&apos;Althy puisse vous proposer des actions pertinentes dès le départ. Vous pouvez passer cette étape.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--althy-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Adresse (optionnel)</label>
          <input value={bien.adresse} onChange={e => setBien(b => ({ ...b, adresse: e.target.value }))} placeholder="Rue de Rive 12" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--althy-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ville / Canton</label>
          <input value={bien.ville} onChange={e => setBien(b => ({ ...b, ville: e.target.value }))} placeholder="Genève, Lausanne, Zurich…" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--althy-text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type de bien</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PROPERTY_TYPES.map(t => (
              <button key={t.value} onClick={() => setBien(b => ({ ...b, type: t.value }))}
                style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: bien.type === t.value ? 'var(--althy-orange)' : 'var(--althy-surface)', color: bien.type === t.value ? '#fff' : 'var(--althy-text)', border: bien.type === t.value ? '1px solid var(--althy-orange)' : '1px solid var(--althy-border)', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step 4 — Email connection ─────────────────────────────────────────────────

function Step4Email({ onSkip }: { onSkip: () => void }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 300, color: 'var(--althy-text)', margin: '0 0 8px' }}>
        Connectez votre messagerie
      </h2>
      <p style={{ fontSize: 13, color: 'var(--althy-text-3)', margin: '0 0 24px', lineHeight: 1.6 }}>
        Althy peut lire vos emails immobiliers pour créer des actions automatiquement. Optionnel, modifiable dans les paramètres.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { id: 'gmail',   label: 'Connecter Gmail',   icon: '📧', color: '#EA4335' },
          { id: 'outlook', label: 'Connecter Outlook',  icon: '📩', color: '#0078D4' },
        ].map(p => (
          <button key={p.id} onClick={onSkip}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12, border: '1px solid var(--althy-border)', background: 'var(--althy-surface)', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--althy-text)', fontFamily: 'inherit', transition: 'border-color 0.15s', textAlign: 'left' }}>
            <span style={{ fontSize: 20 }}>{p.icon}</span>
            {p.label}
          </button>
        ))}
        <button onClick={onSkip}
          style={{ padding: '12px 0', borderRadius: 12, border: '1px solid transparent', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--althy-text-3)', fontFamily: 'inherit' }}>
          Plus tard →
        </button>
      </div>
    </div>
  )
}

// ── Step 5 — Sphere + GO ──────────────────────────────────────────────────────

function Step5Go({ firstName, sphereState, role }: { firstName: string; sphereState: SphereState; role: Role | null }) {
  const roleData = ROLES.find(r => r.id === role)
  const name = firstName ? `, ${firstName}` : ''
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28, filter: 'drop-shadow(0 12px 36px rgba(181,90,48,0.22))' }}>
        <AlthySphereCore state={sphereState} size={140} />
      </div>
      <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: 'var(--althy-text)', margin: '0 0 16px', lineHeight: 1.3 }}>
        Bonjour{name}, je suis Althy,<br />votre assistant immobilier.
      </h2>
      <p style={{ fontSize: 14, color: 'var(--althy-text-3)', margin: '0 0 8px', lineHeight: 1.6, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
        Je suis disponible 24h/24 pour vous aider
        {roleData ? ` — en tant que ${roleData.label.toLowerCase()}, ${roleData.desc.toLowerCase()}` : ''}.
      </p>
      <p style={{ fontSize: 13, color: 'var(--althy-text-3)', margin: '0 0 32px', fontStyle: 'italic' }}>
        Commençons.
      </p>
      {/* The main CTA button is in the parent nav */}
    </div>
  )
}

// ── Auto mode — Vérification ──────────────────────────────────────────────────

interface AutoData {
  profile?: Record<string, unknown>
  agents?: { id: string; nom: string; email?: string }[]
  logo?: string
  nom_agence?: string
}

function AutoVerification({ data, agentChecks, setAgentChecks, onConfirm, saving, firstName }: {
  data: AutoData | null
  agentChecks: Record<string, boolean>
  setAgentChecks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  onConfirm: () => void
  saving: boolean
  firstName: string
}) {
  const [editedProfile, setEditedProfile] = useState<Record<string, string>>({})

  useEffect(() => {
    if (data?.profile) {
      const flat: Record<string, string> = {}
      Object.entries(data.profile).forEach(([k, v]) => { flat[k] = String(v ?? '') })
      setEditedProfile(flat)
    }
  }, [data])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--althy-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px 40px', fontFamily: 'var(--font-sans, DM Sans, system-ui)' }}>
      <header style={{ width: '100%', maxWidth: 680, display: 'flex', alignItems: 'center', padding: '20px 0', marginBottom: 32 }}>
        <Link href="/" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 300, letterSpacing: 4, color: 'var(--althy-orange)', textDecoration: 'none' }}>ALTHY</Link>
      </header>
      <div style={{ width: '100%', maxWidth: 680 }}>
        <p style={{ fontSize: 13, color: 'var(--althy-text-3)', marginBottom: 8, textAlign: 'center' }}>
          Bienvenue dans l&apos;écosystème Althy — votre assistant immobilier.
        </p>
        <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: 'var(--althy-text)', margin: '0 0 24px', textAlign: 'center' }}>
          Vérifiez vos informations{firstName ? `, ${firstName}` : ''}
        </h2>

        {/* Agency logo */}
        {(data?.logo || data?.nom_agence) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'var(--althy-surface)', border: '1px solid var(--althy-border)', borderRadius: 14, marginBottom: 20 }}>
            {data.logo && <img src={data.logo} alt="Logo agence" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 8 }} />}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--althy-text)' }}>{data.nom_agence ?? editedProfile.nom ?? 'Votre agence'}</div>
              <div style={{ fontSize: 12, color: 'var(--althy-text-3)' }}>Données importées automatiquement</div>
            </div>
          </div>
        )}

        {/* Editable profile fields */}
        {data?.profile && (
          <div style={{ background: 'var(--althy-surface)', border: '1px solid var(--althy-border)', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--althy-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Vos informations</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(editedProfile)
                .filter(([k]) => !['role', 'onboarding_completed', 'confidence_score', 'sources_found'].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--althy-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      {k.replace(/_/g, ' ')}
                    </label>
                    <input
                      value={v}
                      onChange={e => setEditedProfile(prev => ({ ...prev, [k]: e.target.value }))}
                      style={inputStyle}
                    />
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* Agents detected */}
        {data?.agents && data.agents.length > 0 && (
          <div style={{ background: 'var(--althy-surface)', border: '1px solid var(--althy-border)', borderRadius: 14, padding: '16px 20px', marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--althy-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Agents détectés ({data.agents.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.agents.map(agent => (
                <label key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: agentChecks[agent.id] ? 'var(--althy-orange-bg, rgba(232,96,44,0.06))' : 'var(--althy-bg)', border: '1px solid var(--althy-border)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={agentChecks[agent.id] ?? false}
                    onChange={e => setAgentChecks(prev => ({ ...prev, [agent.id]: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: 'var(--althy-orange)', flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--althy-text)' }}>{agent.nom}</div>
                    {agent.email && <div style={{ fontSize: 11, color: 'var(--althy-text-3)' }}>{agent.email}</div>}
                  </div>
                </label>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--althy-text-3)', marginTop: 10 }}>
              Décochez les agents que vous ne souhaitez pas inviter maintenant.
            </p>
          </div>
        )}

        <button onClick={onConfirm} disabled={saving}
          style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: 'var(--althy-orange)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Préparation…' : 'Tout est correct — Commencer →'}
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function BienvenueContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: profile } = useUser()

  const isAuto   = searchParams.get('auto') === 'true'
  const sessionId = searchParams.get('sessionId') ?? ''

  const [step, setStep]       = useState<StepId>(1)
  const [role, setRole]       = useState<Role | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [bien, setBien]       = useState({ adresse: '', ville: '', type: 'apartment' })
  const [sphereState, setSphereState] = useState<SphereState>('idle')
  const [autoData, setAutoData]       = useState<AutoData | null>(null)
  const [agentChecks, setAgentChecks] = useState<Record<string, boolean>>({})
  const [saving, setSaving]           = useState(false)

  const firstName = profile?.first_name ?? ''

  // Load auto data from invitation session
  useEffect(() => {
    if (!isAuto || !sessionId) return
    api.get<AutoData>(`/smart-onboarding/session/${sessionId}`)
      .then(r => {
        setAutoData(r.data)
        const checks: Record<string, boolean> = {}
        r.data.agents?.forEach(a => { checks[a.id] = true })
        setAgentChecks(checks)
        if (r.data.profile?.role) setRole(r.data.profile.role as Role)
      })
      .catch(() => {})
  }, [isAuto, sessionId])

  // Animate sphere on step 5
  useEffect(() => {
    if (step !== 5) return
    setSphereState('speaking')
    const t = setTimeout(() => setSphereState('idle'), 3000)
    return () => clearTimeout(t)
  }, [step])

  const TOTAL_STEPS = 5
  const progress = (step / TOTAL_STEPS) * 100

  const questions       = role ? ROLE_QUESTIONS[role] : []
  const allRequired     = questions.filter(q => !q.optional).every(q => answers[q.id]?.trim())
  const canContinueStep = (s: StepId) => {
    if (s === 1) return !!role
    if (s === 2) return allRequired
    return true
  }

  function next() { setStep(s => Math.min(s + 1, TOTAL_STEPS) as StepId) }
  function back() { setStep(s => Math.max(s - 1, 1) as StepId) }

  async function finish() {
    setSaving(true)
    const data: Record<string, unknown> = { ...answers }
    if (bien.adresse || bien.ville) data.premier_bien = bien
    if (isAuto && autoData) {
      data.agents_actifs = Object.entries(agentChecks).filter(([, v]) => v).map(([id]) => id)
    }
    await patchProfile(role ?? 'proprio_solo', data)
    setSaving(false)
    router.push('/app/sphere')
  }

  // Auto mode: show verification screen directly
  if (isAuto) {
    return (
      <AutoVerification
        data={autoData}
        agentChecks={agentChecks}
        setAgentChecks={setAgentChecks}
        onConfirm={finish}
        saving={saving}
        firstName={firstName}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--althy-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px 60px', fontFamily: 'var(--font-sans, DM Sans, system-ui)' }}>

      {/* Header */}
      <header style={{ width: '100%', maxWidth: 680, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0' }}>
        <Link href="/" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 300, letterSpacing: 4, color: 'var(--althy-orange)', textDecoration: 'none' }}>ALTHY</Link>
        <span style={{ fontSize: 12, color: 'var(--althy-text-3)' }}>Étape {step} sur {TOTAL_STEPS}</span>
      </header>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 680, height: 3, background: 'var(--althy-border)', borderRadius: 2, marginBottom: 36, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--althy-orange)', width: `${progress}%`, transition: 'width 0.4s ease', borderRadius: 2 }} />
      </div>

      <div style={{ width: '100%', maxWidth: 680 }}>

        {/* Welcome message — only on step 1 */}
        {step === 1 && (
          <p style={{ fontSize: 13, color: 'var(--althy-text-3)', textAlign: 'center', marginBottom: 28 }}>
            Bienvenue dans l&apos;écosystème Althy — votre assistant immobilier.
          </p>
        )}

        {/* ── Steps ── */}
        {step === 1 && <Step1Role role={role} setRole={setRole} />}
        {step === 2 && role && <Step2Questions role={role} questions={questions} answers={answers} setAnswers={setAnswers} />}
        {step === 3 && <Step3Bien bien={bien} setBien={setBien} />}
        {step === 4 && <Step4Email onSkip={next} />}
        {step === 5 && <Step5Go firstName={firstName} sphereState={sphereState} role={role} />}

        {/* ── Navigation ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 32 }}>

          {/* Back */}
          {step > 1 ? (
            <button onClick={back} style={{ background: 'none', border: 'none', color: 'var(--althy-text-3)', fontSize: 13, cursor: 'pointer', padding: '8px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
              ← Retour
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Skip — steps 3 and 4 are optional */}
            {(step === 3 || step === 4) && (
              <button onClick={next} style={{ background: 'none', border: 'none', color: 'var(--althy-text-3)', fontSize: 13, cursor: 'pointer', padding: '8px 0', textDecoration: 'underline' }}>
                Passer
              </button>
            )}

            {/* Continue / Finish */}
            {step < 5 && step !== 4 && (
              <button
                onClick={next}
                disabled={!canContinueStep(step)}
                style={{
                  padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  border: 'none', cursor: canContinueStep(step) ? 'pointer' : 'not-allowed',
                  background: canContinueStep(step) ? 'var(--althy-orange)' : 'var(--althy-border)',
                  color: canContinueStep(step) ? '#fff' : 'var(--althy-text-3)',
                  transition: 'all 0.15s',
                }}
              >
                Continuer →
              </button>
            )}

            {step === 5 && (
              <button onClick={finish} disabled={saving}
                style={{ padding: '13px 28px', borderRadius: 12, background: 'var(--althy-orange)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Préparation…' : 'Commencer avec Althy →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BienvenuePage() {
  return (
    <Suspense>
      <BienvenueContent />
    </Suspense>
  )
}
