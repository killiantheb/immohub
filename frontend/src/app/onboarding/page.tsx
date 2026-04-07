'use client'
import { useRouter } from 'next/navigation'
import { SmartOnboarding } from '@/components/SmartOnboarding'
import { createClient } from '@/lib/supabase'

const ROLE_ROUTES: Record<string, string> = {
  owner: '/dashboard', agency: '/dashboard',
  opener: '/opener', tenant: '/tenant', company: '/company',
}

export default function OnboardingPage() {
  const router = useRouter()

  async function handleComplete(role: string, data: Record<string, unknown>) {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

      await fetch(`${apiUrl}/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...data,
          onboarding_completed: true,
          onboarding_source: 'althy_ai',
        }),
      })

      // Marque onboarding_completed dans les user_metadata Supabase
      await supabase.auth.updateUser({
        data: { onboarding_completed: true },
      })
    } catch (e) {
      console.error('onboarding patch error', e)
    }

    router.push(ROLE_ROUTES[role] ?? '/dashboard')
  }

  return <SmartOnboarding onComplete={handleComplete} />
}
