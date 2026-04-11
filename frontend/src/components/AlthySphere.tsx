'use client'

interface Props {
  size?: number
  speaking?: boolean
  energy?: number
  className?: string
}

export function AlthySphere({ size = 240, speaking = false, className }: Props) {
  const r = size * 0.04
  const r2 = size * 0.09
  const blur = size * 0.18

  return (
    <>
      <style>{`
        @keyframes althyBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.028)}}
        @keyframes althySpeak{0%{transform:scale(0.97)}100%{transform:scale(1.04)}}
      `}</style>
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 36% 30%, #FFAA6A 0%, var(--althy-orange) 30%, #C03C10 60%, #6A1A06 100%)',
          boxShadow: speaking
            ? `0 0 0 ${r}px rgba(212,96,26,0.14), 0 0 0 ${r2}px rgba(212,96,26,0.07), 0 ${r}px ${blur}px rgba(212,96,26,0.40)`
            : `0 0 0 ${r * 0.7}px rgba(212,96,26,0.07), 0 ${r}px ${blur * 0.85}px rgba(212,96,26,0.20)`,
          animation: speaking
            ? 'althySpeak 0.45s ease-in-out infinite alternate'
            : 'althyBreathe 4s ease-in-out infinite',
          transition: 'box-shadow 0.4s ease',
          flexShrink: 0,
        }}
      />
    </>
  )
}
