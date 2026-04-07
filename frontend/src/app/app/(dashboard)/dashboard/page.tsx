'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/lib/auth'
import CathyHome from '@/components/CathyHome'

export default function DashboardPage() {
  const { data: profile, isLoading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (isLoading || !profile) return
    // Rôles avec un espace dédié → redirection directe
    if (profile.role === 'tenant')    router.replace('/app/tenant')
    if (profile.role === 'opener')    router.replace('/app/openers')
    if (profile.role === 'company')   router.replace('/app/rfqs')
    if (profile.role === 'insurance') router.replace('/app/insurance')
  }, [profile, isLoading, router])

  // Pour owner/agency/super_admin : CathyHome (briefing IA)
  return <CathyHome />
}
