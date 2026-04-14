"use client";

interface AlthyLogoProps {
  size?:      number;
  animated?:  boolean;
  className?: string;
}

/**
 * AlthyLogo — sphère 3D miniature avec glow + shimmer.
 * Utilisée dans DashboardSidebar et partout où on a besoin d'un logo compact.
 * `animated` ajoute un léger pulse (breath) via CSS keyframes inline.
 */
export function AlthyLogo({ size = 36, animated = false, className = "" }: AlthyLogoProps) {
  const uid = "althy-logo"; // IDs stables (pas de crypto.randomUUID côté serveur)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={animated ? { animation: "althy-logo-breath 3.5s ease-in-out infinite" } : undefined}
    >
      {animated && (
        <style>{`
          @keyframes althy-logo-breath {
            0%, 100% { filter: drop-shadow(0 0 6px rgba(232,96,44,0.35)); transform: scale(1); }
            50%       { filter: drop-shadow(0 0 14px rgba(232,96,44,0.55)); transform: scale(1.04); }
          }
        `}</style>
      )}

      <defs>
        {/* Gradient principal — highlight en haut-gauche */}
        <radialGradient id={`${uid}-main`} cx="35%" cy="30%" r="70%" fx="32%" fy="27%">
          <stop offset="0%"   stopColor="#FFA87A" />
          <stop offset="28%"  stopColor="#E8602C" />
          <stop offset="75%"  stopColor="#C84E1E" />
          <stop offset="100%" stopColor="#8B2E08" />
        </radialGradient>

        {/* Gradient glow ambiant derrière la sphère */}
        <radialGradient id={`${uid}-glow`} cx="50%" cy="52%" r="50%">
          <stop offset="0%"   stopColor="#E8602C" stopOpacity="0.30" />
          <stop offset="60%"  stopColor="#E8602C" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#E8602C" stopOpacity="0" />
        </radialGradient>

        {/* Shimmer principal */}
        <radialGradient id={`${uid}-shimmer1`} cx="38%" cy="32%" r="45%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.72" />
          <stop offset="55%"  stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* Shimmer secondaire (petite tache) */}
        <radialGradient id={`${uid}-shimmer2`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.50" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* Ombre portée douce en bas */}
        <radialGradient id={`${uid}-shadow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#5C1A00" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#5C1A00" stopOpacity="0" />
        </radialGradient>

        {/* Filtre blob (légère distorsion organique) */}
        <filter id={`${uid}-blob`} x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Filtre glow externe */}
        <filter id={`${uid}-glow-filter`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* ── Glow ambiant (halo derrière) ── */}
      <circle
        cx="50" cy="52" r="46"
        fill={`url(#${uid}-glow)`}
      />

      {/* ── Sphère principale (avec distorsion organique) ── */}
      <circle
        cx="50" cy="50" r="40"
        fill={`url(#${uid}-main)`}
        filter={`url(#${uid}-blob)`}
      />

      {/* ── Rebord subtil (donne l'épaisseur 3D) ── */}
      <circle
        cx="50" cy="50" r="40"
        fill="none"
        stroke="rgba(90,30,0,0.18)"
        strokeWidth="1"
      />

      {/* ── Ombre interne bas ── */}
      <ellipse
        cx="50" cy="76"
        rx="28" ry="16"
        fill={`url(#${uid}-shadow)`}
      />

      {/* ── Shimmer principal (grande tache diffuse haut-gauche) ── */}
      <ellipse
        cx="38" cy="33"
        rx="19" ry="13"
        fill={`url(#${uid}-shimmer1)`}
        transform="rotate(-22 38 33)"
      />

      {/* ── Shimmer secondaire (petite tache nette) ── */}
      <ellipse
        cx="57" cy="26"
        rx="6" ry="4"
        fill={`url(#${uid}-shimmer2)`}
        transform="rotate(-18 57 26)"
        opacity="0.55"
      />

      {/* ── Micro-highlight (point de lumière) ── */}
      <circle
        cx="44" cy="29"
        r="2.5"
        fill="white"
        opacity="0.40"
      />
    </svg>
  );
}
