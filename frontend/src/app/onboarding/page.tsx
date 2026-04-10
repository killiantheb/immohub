import { redirect } from 'next/navigation'

// /onboarding → /bienvenue (permanent redirect, see also next.config.js)
export default function OnboardingRedirect() {
  redirect('/bienvenue')
}
