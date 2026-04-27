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
          background: 'radial-gradient(circle at 36% 30%, #C9A961 0%, #1A4975 30%, #0F2E4C 60%, #051A30 100%)',
          boxShadow: speaking
            ? `0 0 0 ${r}px rgba(201,169,97,0.18), 0 0 0 ${r2}px rgba(201,169,97,0.09), 0 ${r}px ${blur}px rgba(15,46,76,0.40)`
            : `0 0 0 ${r * 0.7}px rgba(201,169,97,0.10), 0 ${r}px ${blur * 0.85}px rgba(15,46,76,0.25)`,
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
