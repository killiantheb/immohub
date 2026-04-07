'use client'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CathySphere } from '@/components/CathySphere'
import { createClient } from '@/lib/supabase'
import { baseURL } from '@/lib/api'
import { useAuth, useUser } from '@/lib/auth'
import { useAuthStore } from '@/lib/store/authStore'

const BG = '#FAF5EB'
const O  = '#D4601A'
const T  = '#1C0F06'
const T5 = 'rgba(80,35,8,0.55)'
const T3 = 'rgba(80,35,8,0.30)'

// Libellés rôle
const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  agency: 'Agence',
  super_admin: 'Admin',
  tenant: 'Locataire',
  opener: 'Ouvreur',
  company: 'Artisan',
  insurance: 'Assureur',
}

// Page d'accueil par rôle (quand l'utilisateur clique "Mon espace")
function getHomePath(role?: string) {
  if (role === 'tenant')    return '/app/tenant'
  if (role === 'opener')    return '/app/openers'
  if (role === 'company')   return '/app/rfqs'
  if (role === 'insurance') return '/app/insurance'
  return '/app/overview'
}

// Nav links par rôle
function getNavLinks(role?: string) {
  const base = [{ href: '/app/dashboard', label: 'Accueil' }]
  if (role === 'tenant') return [
    ...base,
    { href: '/app/tenant',       label: 'Mon logement' },
    { href: '/app/contracts',    label: 'Mon bail' },
    { href: '/app/favorites',    label: 'Favoris' },
    { href: '/app/rfqs',         label: 'Signalements' },
    { href: '/app/advisor',      label: 'Conseiller IA' },
    { href: '/app/profile',      label: 'Profil' },
  ]
  if (role === 'insurance') return [
    ...base,
    { href: '/app/insurance',    label: 'Mes offres' },
    { href: '/app/rfqs',         label: 'Appels d\'offre' },
    { href: '/app/advisor',      label: 'Conseiller IA' },
    { href: '/app/profile',      label: 'Profil' },
  ]
  if (role === 'opener') return [
    ...base,
    { href: '/app/openers',      label: 'Missions' },
    { href: '/app/openers/profile', label: 'Mon profil ouvreur' },
    { href: '/app/openers/map',  label: 'Carte' },
    { href: '/app/rfqs',         label: 'Appels d\'offre' },
    { href: '/app/advisor',      label: 'Conseiller IA' },
    { href: '/app/profile',      label: 'Profil' },
  ]
  if (role === 'company') return [
    ...base,
    { href: '/app/rfqs',         label: 'Appels d\'offre' },
    { href: '/app/companies',    label: 'Mon entreprise' },
    { href: '/app/transactions', label: 'Paiements' },
    { href: '/app/advisor',      label: 'Conseiller IA' },
    { href: '/app/profile',      label: 'Profil' },
  ]
  // owner / agency / super_admin
  return [
    ...base,
    { href: '/app/properties',   label: 'Biens' },
    { href: '/app/contracts',    label: 'Contrats' },
    { href: '/app/transactions', label: 'Transactions' },
    { href: '/app/accounting',   label: 'Comptabilité' },
    { href: '/app/openers',      label: 'Missions' },
    { href: '/app/rfqs',         label: 'Appels d\'offre' },
    { href: '/app/documents',    label: 'Documents' },
    { href: '/app/overview',     label: 'Vue d\'ensemble' },
    { href: '/app/advisor',      label: 'Conseiller IA' },
    { href: '/app/settings',     label: 'Paramètres' },
    { href: '/app/profile',      label: 'Profil' },
  ]
}

function getQuickLinks(role?: string) {
  if (role === 'tenant') return [
    { href: '/app/tenant',       label: 'Logement',    icon: '🏠' },
    { href: '/app/favorites',    label: 'Favoris',     icon: '❤️' },
    { href: '/app/contracts',    label: 'Mon bail',    icon: '📄' },
    { href: '/app/rfqs',         label: 'Signaler',    icon: '🔔' },
    { href: '/app/advisor',      label: 'Conseiller',  icon: '⚖️' },
    { href: '/app/profile',      label: 'Profil',      icon: '👤' },
  ]
  if (role === 'insurance') return [
    { href: '/app/insurance',    label: 'Mes offres',  icon: '🛡️' },
    { href: '/app/rfqs',         label: 'Appels',      icon: '🔨' },
    { href: '/app/advisor',      label: 'Conseiller',  icon: '⚖️' },
    { href: '/app/profile',      label: 'Profil',      icon: '👤' },
  ]
  if (role === 'opener') return [
    { href: '/app/openers',         label: 'Missions',  icon: '📍' },
    { href: '/app/openers/profile', label: 'Mon profil',icon: '👤' },
    { href: '/app/openers/map',     label: 'Carte',     icon: '🗺️' },
    { href: '/app/rfqs',            label: 'Appels',    icon: '🔨' },
    { href: '/app/advisor',         label: 'Conseiller',icon: '⚖️' },
    { href: '/app/profile',         label: 'Compte',    icon: '⚙️' },
  ]
  if (role === 'company') return [
    { href: '/app/rfqs',         label: 'Appels d\'offre', icon: '🔨' },
    { href: '/app/companies',    label: 'Entreprise',       icon: '🏢' },
    { href: '/app/transactions', label: 'Paiements',        icon: '💶' },
    { href: '/app/advisor',      label: 'Conseiller',       icon: '⚖️' },
    { href: '/app/profile',      label: 'Profil',           icon: '👤' },
  ]
  return [
    { href: '/app/properties',   label: 'Biens',           icon: '🏠' },
    { href: '/app/contracts',    label: 'Contrats',        icon: '📄' },
    { href: '/app/documents',    label: 'Documents',       icon: '📑' },
    { href: '/app/transactions', label: 'Transactions',    icon: '💶' },
    { href: '/app/accounting',   label: 'Comptabilité',    icon: '📊' },
    { href: '/app/openers',      label: 'Missions',        icon: '📍' },
    { href: '/app/advisor',      label: 'Conseiller IA',   icon: '⚖️' },
  ]
}

export function CathyShell({ children }: { children: React.ReactNode }) {
  const [showDashboard, setShowDashboard] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [status, setStatus] = useState('à votre écoute')
  const [input, setInput] = useState('')
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()
  const { user } = useAuthStore()
  const { data: profile } = useUser()

  // Rôle depuis le profil DB (canonique), fallback sur Supabase metadata
  const role = profile?.role ?? (user?.user_metadata?.role as string | undefined)
  const NAV_LINKS = getNavLinks(role)
  const QUICK_LINKS = getQuickLinks(role)

  // Auto-show dashboard si on est sur une page de contenu (pas l'accueil sphère)
  useEffect(() => {
    if (pathname !== '/app/dashboard') {
      setShowDashboard(true)
    }
  }, [pathname])

  // Guard onboarding
  useEffect(() => {
    if (user && !user.user_metadata?.onboarding_completed && pathname !== '/onboarding') {
      router.push('/onboarding')
    }
  }, [user, pathname, router])

  async function handleLogout() {
    try {
      await signOut()
    } catch { /* ignore */ }
    router.push('/login')
  }

  async function handleSend(transcript?: string) {
    const msg = (transcript ?? input).trim()
    if (!msg) return
    setInput('')
    setSpeaking(true)
    setStatus('Althy analyse…')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const apiUrl = baseURL

      const actionRes = await fetch(`${apiUrl}/ai/voice-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transcript: msg }),
      })

      if (actionRes.ok) {
        const action = await actionRes.json() as { intent: string; message: string; navigate_path?: string; property_id?: string }
        setStatus(action.message?.substring(0, 90) ?? 'Compris.')

        if (action.intent === 'create_property' && action.property_id) {
          setShowDashboard(true)
          setTimeout(() => router.push(`/app/properties/${action.property_id}`), 1500)
          return
        }
        if (action.intent === 'navigate' && action.navigate_path) {
          setShowDashboard(true)
          setTimeout(() => router.push(action.navigate_path!), 1000)
          return
        }
        if (action.intent === 'question') {
          const res = await fetch(`${apiUrl}/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ message: msg, context: { session_id: sessionIdRef.current } }),
          })
          const reader = res.body?.getReader()
          const decoder = new TextDecoder()
          let reply = ''
          if (reader) {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunk = decoder.decode(value)
              for (const line of chunk.split('\n')) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try { const p = JSON.parse(line.slice(6)); if (p.text) reply += p.text } catch { /* */ }
                }
              }
              if (reply.length > 100) break
            }
            reader.cancel()
          }
          const short = reply.trim() || action.message || 'Je traite votre demande.'
          setStatus(short.length > 90 ? short.substring(0, 90) + '…' : short)
          return
        }
        return
      }
      setStatus('Réessayez dans un moment.')
    } catch {
      setStatus('Réessayez dans un moment.')
    } finally {
      setSpeaking(false)
    }
  }

  // ── Sphere view (page d'accueil Althy) ──────────────────────────────────────
  if (!showDashboard) {
    const homePath = getHomePath(role)
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', fontFamily: 'var(--font-sans)', padding: '2rem 1.2rem' }}>

        {/* Rôle badge */}
        {role && (
          <div style={{ position: 'absolute', top: 16, left: 16, padding: '5px 12px', borderRadius: 20, background: 'rgba(212,96,26,0.08)', border: `0.5px solid rgba(212,96,26,0.2)`, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: O }}>
            {ROLE_LABELS[role] ?? role}
          </div>
        )}

        {/* Boutons top-right */}
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
          <button
            onClick={() => router.push(homePath)}
            style={{ padding: '6px 14px', borderRadius: 20, border: `0.5px solid rgba(212,96,26,0.25)`, background: O, color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Mon espace →
          </button>
          <button
            onClick={() => setShowDashboard(true)}
            style={{ padding: '6px 14px', borderRadius: 20, border: `0.5px solid rgba(212,96,26,0.25)`, background: 'rgba(212,96,26,0.07)', color: O, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Navigation
          </button>
        </div>

        {/* Title */}
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 11, fontWeight: 300, letterSpacing: '8px', color: 'rgba(180,80,20,0.45)', textTransform: 'uppercase', marginBottom: '2rem' }}>Althy</p>

        {/* Sphere */}
        <div style={{ marginBottom: '1.8rem', animation: 'althyFloat 5.5s ease-in-out infinite' }} suppressHydrationWarning>
          <CathySphere size={200} speaking={speaking} />
        </div>

        {/* Status */}
        <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: T5, marginBottom: '1.6rem', textAlign: 'center', minHeight: 16 }}>{status}</p>

        {/* Mic button */}
        <button
          onClick={() => setSpeaking(!speaking)}
          style={{ width: 48, height: 48, borderRadius: '50%', border: `1px solid ${speaking ? O : 'rgba(212,96,26,0.25)'}`, background: speaking ? 'rgba(212,96,26,0.10)' : 'rgba(212,96,26,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '1.2rem' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={speaking ? O : T5} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3"/>
            <path d="M5 10a7 7 0 0014 0"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
            <line x1="9" y1="22" x2="15" y2="22"/>
          </svg>
        </button>

        {/* Text input */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff', borderRadius: 28, padding: '8px 8px 8px 18px', border: `0.5px solid rgba(212,96,26,0.2)`, width: '100%', maxWidth: 340, marginBottom: '2rem' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Posez une question à Althy…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T, fontFamily: 'inherit' }}
          />
          <button
            onClick={() => handleSend()}
            style={{ width: 32, height: 32, borderRadius: '50%', background: O, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        {/* Quick access shortcuts */}
        <div style={{ width: '100%', maxWidth: 360 }}>
          <p style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T3, marginBottom: '0.8rem', textAlign: 'center' }}>Accès rapide</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {QUICK_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setShowDashboard(true)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '12px 8px', borderRadius: 14, background: '#fff', border: `0.5px solid rgba(212,96,26,0.15)`, textDecoration: 'none' }}
              >
                <span style={{ fontSize: 20 }}>{link.icon}</span>
                <span style={{ fontSize: 11, color: T5, letterSpacing: '0.3px', textAlign: 'center' }}>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{ marginTop: '2rem', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T3, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}
        >
          Déconnexion
        </button>
      </div>
    )
  }

  // ── Dashboard view (nav + contenu) ───────────────────────────────────────────
  const roleLabel = ROLE_LABELS[role ?? ''] ?? role ?? ''

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: `0.5px solid rgba(160,92,40,0.12)`, padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => {
              if (pathname === '/app/dashboard') {
                setShowDashboard(false)
              } else {
                router.back()
              }
            }}
            style={{ padding: '6px 12px', borderRadius: 20, border: `0.5px solid rgba(160,92,40,0.2)`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: T5, fontFamily: 'inherit' }}
          >
            ←
          </button>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 300, color: O, letterSpacing: '3px' }}>Althy</span>
          {roleLabel && (
            <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(212,96,26,0.08)', color: O, letterSpacing: '1px', textTransform: 'uppercase' }}>
              {roleLabel}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => router.push(getHomePath(role))}
            style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: O, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}
          >
            Mon espace
          </button>
          <button
            onClick={handleLogout}
            style={{ padding: '6px 14px', borderRadius: 20, border: `0.5px solid rgba(160,92,40,0.2)`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: T5, fontFamily: 'inherit' }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: `0.5px solid rgba(160,92,40,0.08)`, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
        <div style={{ display: 'flex', padding: '0 1.5rem', gap: 2, minWidth: 'max-content' }}>
          {NAV_LINKS.map(link => {
            const active = pathname === link.href || (link.href !== '/app/dashboard' && pathname.startsWith(link.href))
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{ padding: '10px 14px', fontSize: 13, color: active ? O : T5, fontWeight: active ? 500 : 400, borderBottom: active ? `2px solid ${O}` : '2px solid transparent', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color 0.15s', display: 'block' }}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Content */}
      <main style={{ padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  )
}
