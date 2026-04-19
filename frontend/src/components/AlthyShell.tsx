'use client'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AlthySphere } from '@/components/AlthySphere'
import { createClient } from '@/lib/supabase'
import { baseURL } from '@/lib/api'
import { useAuth, useUser } from '@/lib/auth'
import { useAuthStore } from '@/lib/store/authStore'

const BG = '#FAF5EB'
const O  = '#D4601A'
const T  = '#1C0F06'
const T5 = 'rgba(80,35,8,0.55)'
const T3 = 'rgba(80,35,8,0.30)'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propriétaire',
  agency: 'Agence',
  super_admin: 'Admin',
  tenant: 'Locataire',
  opener: 'Ouvreur',
  company: 'Artisan',
  insurance: 'Assureur',
  proprio_solo: 'Propriétaire',
  agence: 'Agence',
  locataire: 'Locataire',
  artisan: 'Artisan',
  expert: 'Expert',
  hunter: 'Hunter',
  portail_proprio: 'Portail Proprio',
  acheteur_premium: 'Acheteur',
}

function getHomePath(role?: string) {
  if (role === 'tenant' || role === 'locataire') return '/app/locataire'
  if (role === 'opener') return '/app/ouvreurs'
  if (role === 'company' || role === 'artisan') return '/app/artisans'
  return '/app'
}

function getNavLinks(role?: string) {
  const base = [{ href: '/app/sphere', label: 'Althy IA' }]
  if (role === 'tenant' || role === 'locataire') return [
    ...base,
    { href: '/app/locataire',  label: 'Mon logement' },
    { href: '/app/documents',  label: 'Documents' },
    { href: '/app/settings',   label: 'Paramètres' },
  ]
  if (role === 'opener') return [
    ...base,
    { href: '/app/ouvreurs',           label: 'Missions' },
    { href: '/app/ouvreurs/revenus',   label: 'Revenus' },
    { href: '/app/settings',           label: 'Paramètres' },
  ]
  if (role === 'company' || role === 'artisan') return [
    ...base,
    { href: '/app/artisans/devis',     label: 'Devis' },
    { href: '/app/artisans/chantiers', label: 'Chantiers' },
    { href: '/app/settings',           label: 'Paramètres' },
  ]
  return [
    ...base,
    { href: '/app/biens',        label: 'Biens' },
    { href: '/app/crm',          label: 'CRM' },
    { href: '/app/comptabilite', label: 'Comptabilité' },
    { href: '/app/ouvreurs',     label: 'Missions' },
    { href: '/app/documents',    label: 'Documents' },
    { href: '/app/settings',     label: 'Paramètres' },
  ]
}

function getQuickLinks(role?: string) {
  if (role === 'tenant' || role === 'locataire') return [
    { href: '/app/locataire', label: 'Logement',   icon: '🏠' },
    { href: '/app/documents', label: 'Documents',   icon: '📄' },
    { href: '/app/settings',  label: 'Paramètres',  icon: '⚙️' },
  ]
  if (role === 'opener') return [
    { href: '/app/ouvreurs',         label: 'Missions',  icon: '📍' },
    { href: '/app/ouvreurs/revenus', label: 'Revenus',   icon: '💶' },
    { href: '/app/settings',         label: 'Paramètres',icon: '⚙️' },
  ]
  if (role === 'company' || role === 'artisan') return [
    { href: '/app/artisans/devis',     label: 'Devis',     icon: '🔨' },
    { href: '/app/artisans/chantiers', label: 'Chantiers', icon: '🏗️' },
    { href: '/app/settings',           label: 'Paramètres',icon: '⚙️' },
  ]
  return [
    { href: '/app/biens',        label: 'Biens',          icon: '🏠' },
    { href: '/app/crm',          label: 'CRM',            icon: '👥' },
    { href: '/app/comptabilite', label: 'Comptabilité',   icon: '📊' },
    { href: '/app/ouvreurs',     label: 'Missions',       icon: '📍' },
    { href: '/app/sphere',       label: 'Althy IA',       icon: '✦' },
  ]
}

export function AlthyShell({ children }: { children: React.ReactNode }) {
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

  const role = profile?.role ?? (user?.user_metadata?.role as string | undefined)
  const NAV_LINKS = getNavLinks(role)
  const QUICK_LINKS = getQuickLinks(role)

  useEffect(() => {
    if (pathname !== '/app/sphere') {
      setShowDashboard(true)
    }
  }, [pathname])

  useEffect(() => {
    if (user && !user.user_metadata?.onboarding_completed && pathname !== '/bienvenue') {
      router.push('/bienvenue')
    }
  }, [user, pathname, router])

  async function handleLogout() {
    try { await signOut() } catch { /* ignore */ }
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

      const actionRes = await fetch(`${baseURL}/sphere/voice-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transcript: msg }),
      })

      if (actionRes.ok) {
        const action = await actionRes.json() as { intent: string; message: string; navigate_path?: string; property_id?: string }
        setStatus(action.message?.substring(0, 90) ?? 'Compris.')

        if (action.intent === 'create_property' && action.property_id) {
          setShowDashboard(true)
          setTimeout(() => router.push(`/app/biens/${action.property_id}`), 1500)
          return
        }
        if (action.intent === 'navigate' && action.navigate_path) {
          setShowDashboard(true)
          setTimeout(() => router.push(action.navigate_path!), 1000)
          return
        }
        if (action.intent === 'question') {
          const res = await fetch(`${baseURL}/sphere/chat`, {
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

  if (!showDashboard) {
    const homePath = getHomePath(role)
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', fontFamily: 'var(--font-sans)', padding: '2rem 1.2rem' }}>

        {role && (
          <div style={{ position: 'absolute', top: 16, left: 16, padding: '5px 12px', borderRadius: 20, background: 'rgba(212,96,26,0.08)', border: `0.5px solid rgba(212,96,26,0.2)`, fontSize: 10, letterSpacing: '1px', textTransform: 'uppercase', color: O }}>
            {ROLE_LABELS[role] ?? role}
          </div>
        )}

        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
          <button onClick={() => router.push(homePath)} style={{ padding: '6px 14px', borderRadius: 20, border: `0.5px solid rgba(212,96,26,0.25)`, background: O, color: '#fff', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            Mon espace →
          </button>
          <button onClick={() => setShowDashboard(true)} style={{ padding: '6px 14px', borderRadius: 20, border: `0.5px solid rgba(212,96,26,0.25)`, background: 'rgba(212,96,26,0.07)', color: O, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            Navigation
          </button>
        </div>

        <Link href="/" style={{ fontFamily: 'var(--font-serif)', fontSize: 11, fontWeight: 300, letterSpacing: '8px', color: 'rgba(180,80,20,0.45)', textTransform: 'uppercase', marginBottom: '2rem', textDecoration: 'none', display: 'block' }}>Althy</Link>

        <div style={{ marginBottom: '1.8rem', animation: 'althyFloat 5.5s ease-in-out infinite' }} suppressHydrationWarning>
          <AlthySphere size={200} speaking={speaking} />
        </div>

        <p style={{ fontSize: 11, letterSpacing: '2.5px', textTransform: 'uppercase', color: T5, marginBottom: '1.6rem', textAlign: 'center', minHeight: 16 }}>{status}</p>

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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff', borderRadius: 28, padding: '8px 8px 8px 18px', border: `0.5px solid rgba(212,96,26,0.2)`, width: '100%', maxWidth: 340, marginBottom: '2rem' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Posez une question à Althy…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: T, fontFamily: 'inherit' }}
          />
          <button onClick={() => handleSend()} style={{ width: 32, height: 32, borderRadius: '50%', background: O, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        <div style={{ width: '100%', maxWidth: 360 }}>
          <p style={{ fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T3, marginBottom: '0.8rem', textAlign: 'center' }}>Accès rapide</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {QUICK_LINKS.map(link => (
              <Link key={link.href} href={link.href} onClick={() => setShowDashboard(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '12px 8px', borderRadius: 14, background: '#fff', border: `0.5px solid rgba(212,96,26,0.15)`, textDecoration: 'none' }}>
                <span style={{ fontSize: 20 }}>{link.icon}</span>
                <span style={{ fontSize: 11, color: T5, letterSpacing: '0.3px', textAlign: 'center' }}>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <button onClick={handleLogout} style={{ marginTop: '2rem', fontSize: 10, letterSpacing: '2px', textTransform: 'uppercase', color: T3, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>
          Déconnexion
        </button>

        <style>{`@keyframes althyFloat{0%,100%{transform:translateY(0)}40%{transform:translateY(-12px)}70%{transform:translateY(-5px)}}`}</style>
      </div>
    )
  }

  const roleLabel = ROLE_LABELS[role ?? ''] ?? role ?? ''

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <header style={{ background: '#fff', borderBottom: `0.5px solid rgba(160,92,40,0.12)`, padding: '0 1.5rem', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { if (pathname === '/app/sphere') { setShowDashboard(false) } else { router.back() } }} style={{ padding: '6px 12px', borderRadius: 20, border: `0.5px solid rgba(160,92,40,0.2)`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: T5, fontFamily: 'inherit' }}>←</button>
          <Link href="/" style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 300, color: O, letterSpacing: '3px', textDecoration: 'none' }}>Althy</Link>
          {roleLabel && (
            <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: 'rgba(212,96,26,0.08)', color: O, letterSpacing: '1px', textTransform: 'uppercase' }}>
              {roleLabel}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.push(getHomePath(role))} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: O, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
            Mon espace
          </button>
          <button onClick={handleLogout} style={{ padding: '6px 14px', borderRadius: 20, border: `0.5px solid rgba(160,92,40,0.2)`, background: 'transparent', cursor: 'pointer', fontSize: 12, color: T5, fontFamily: 'inherit' }}>
            Déconnexion
          </button>
        </div>
      </header>

      <nav style={{ background: '#fff', borderBottom: `0.5px solid rgba(160,92,40,0.08)`, overflowX: 'auto', WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'] }}>
        <div style={{ display: 'flex', padding: '0 1.5rem', gap: 2, minWidth: 'max-content' }}>
          {NAV_LINKS.map(link => {
            const active = pathname === link.href || (link.href !== '/app/sphere' && pathname.startsWith(link.href))
            return (
              <Link key={link.href} href={link.href} style={{ padding: '10px 14px', fontSize: 13, color: active ? O : T5, fontWeight: active ? 500 : 400, borderBottom: active ? `2px solid ${O}` : '2px solid transparent', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'color 0.15s', display: 'block' }}>
                {link.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <main style={{ padding: '1.5rem' }}>
        {children}
      </main>
    </div>
  )
}
