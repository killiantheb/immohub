'use client'
import { AlthySphere } from './AlthySphere'

export function HeroSphere() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem', filter: 'drop-shadow(0 24px 64px rgba(201,169,97,0.28))', animation: 'althyFloat 5.5s ease-in-out infinite' }}>
      <style>{`@keyframes althyFloat{0%,100%{transform:translateY(0)}40%{transform:translateY(-12px)}70%{transform:translateY(-5px)}}`}</style>
      <AlthySphere size={200} />
    </div>
  )
}
