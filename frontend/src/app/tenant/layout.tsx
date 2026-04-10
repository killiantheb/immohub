'use client'
import Link from 'next/link'

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header style={{ height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: '#fff', borderBottom: '1px solid #EAE3D9' }}>
        <Link href="/" style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '20px', fontWeight: 300, letterSpacing: '4px', color: '#1A1612', textDecoration: 'none' }}>
          ALTHY
        </Link>
        <Link href="/login" style={{ fontSize: '13px', color: '#8A7A6A', textDecoration: 'none', padding: '7px 16px', border: '1px solid #EAE3D9', borderRadius: '8px' }}>
          Se connecter
        </Link>
      </header>
      {children}
    </>
  )
}
