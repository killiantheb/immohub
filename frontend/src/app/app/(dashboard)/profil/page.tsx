'use client'
// Sprint 9 Lot C — Page "Mon profil" en lecture seule.
//
// Refonte UX : la page profil ne porte plus d'inputs éditables. Toute
// modification d'identité, téléphone, IBAN/BIC, etc. passe désormais par
// /app/settings (source unifiée). Ici on affiche un résumé non-éditable
// + un CTA "Modifier dans Paramètres".
//
// Audit : doublon avatar top-right + bouton sidebar "Mon profil" supprimé
// dans le même sprint (cf commit "chore(sidebar): Phase 1.0 simplification").
// Le dropdown UserMenu pointe désormais ici, et "Paramètres" est l'unique
// point d'entrée pour éditer son profil.

import Link from 'next/link'
import { ArrowRight, User } from 'lucide-react'
import { useUser } from '@/lib/auth'
import { useRole } from '@/lib/hooks/useRole'
import { C } from '@/lib/design-tokens'

export default function ProfilePage() {
  const { data: profile } = useUser()
  const { label: roleLabel } = useRole()

  const firstName = profile?.first_name ?? ''
  const lastName  = profile?.last_name  ?? ''
  const fullName  = `${firstName}${firstName && lastName ? ' ' : ''}${lastName}`.trim() || '—'

  const cardStyle: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 14,
    boxShadow: C.shadow,
    padding: 24,
    marginBottom: 16,
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: '1px',
    textTransform: 'uppercase',
    color: C.text3,
    marginBottom: 4,
    fontWeight: 500,
  }

  const valueStyle: React.CSSProperties = {
    fontSize: 15,
    color: C.text,
    fontWeight: 500,
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem 0' }}>

      {/* Header avec avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: '2rem' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--althy-gold), var(--althy-prussian))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {firstName ? (
            <span style={{ fontSize: 28, fontWeight: 600, color: '#fff' }}>
              {firstName[0].toUpperCase()}
            </span>
          ) : (
            <User size={32} color="#fff" strokeWidth={1.5} />
          )}
        </div>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 32,
              fontWeight: 400,
              color: C.text,
              letterSpacing: 0.5,
              margin: 0,
              marginBottom: 4,
            }}
          >
            {fullName}
          </h1>
          <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>
            {roleLabel ?? 'Utilisateur'}
          </p>
        </div>
      </div>

      {/* Identité */}
      <section style={cardStyle}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: C.text3,
            marginTop: 0,
            marginBottom: 16,
          }}
        >
          Identité
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={labelStyle}>Prénom</div>
            <div style={valueStyle}>{firstName || '—'}</div>
          </div>
          <div>
            <div style={labelStyle}>Nom</div>
            <div style={valueStyle}>{lastName || '—'}</div>
          </div>
          <div>
            <div style={labelStyle}>Email</div>
            <div style={valueStyle}>{profile?.email || '—'}</div>
          </div>
          <div>
            <div style={labelStyle}>Téléphone</div>
            <div style={valueStyle}>{profile?.phone || '—'}</div>
          </div>
        </div>
      </section>

      {/* CTA Paramètres */}
      <Link
        href="/app/settings"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderRadius: 14,
          background: C.surface,
          border: `1px solid ${C.border}`,
          boxShadow: C.shadow,
          textDecoration: 'none',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = C.prussian
          e.currentTarget.style.background = 'var(--althy-prussian-bg, rgba(15,46,76,0.04))'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = C.border
          e.currentTarget.style.background = C.surface
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 2 }}>
            Modifier mon profil
          </div>
          <div style={{ fontSize: 12, color: C.text3 }}>
            Toutes les modifications (identité, téléphone, coordonnées bancaires…) se font dans Paramètres
          </div>
        </div>
        <ArrowRight size={18} strokeWidth={1.5} style={{ color: C.prussian, flexShrink: 0 }} />
      </Link>
    </div>
  )
}
