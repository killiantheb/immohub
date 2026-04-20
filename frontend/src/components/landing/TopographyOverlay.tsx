"use client";

/**
 * TopographyOverlay — SVG léger animé par-dessus la carte du hero.
 *
 * Effet : lignes de niveau concentriques subtiles (style carte topographique suisse),
 * animées par un lent glissement et une variation d'opacité. Zéro coût réseau
 * (SVG inline, ~2.5 KB gzippé) et GPU-friendly.
 */
export function TopographyOverlay({ color = "#C9A961", opacity = 0.08 }: { color?: string; opacity?: number }) {
  return (
    <>
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          mixBlendMode: "screen",
          opacity,
          animation: "topo-drift 40s linear infinite",
        }}
      >
        <defs>
          <pattern
            id="topo-pattern"
            width="220"
            height="220"
            patternUnits="userSpaceOnUse"
          >
            <g fill="none" stroke={color} strokeWidth="0.9">
              <path d="M0 110 Q 55 80, 110 110 T 220 110" />
              <path d="M0 150 Q 55 120, 110 150 T 220 150" />
              <path d="M0 70 Q 55 40, 110 70 T 220 70" />
              <path d="M-20 190 Q 40 170, 100 190 T 220 180" />
              <ellipse cx="110" cy="110" rx="60" ry="32" />
              <ellipse cx="110" cy="110" rx="30" ry="14" />
              <ellipse cx="30" cy="40" rx="18" ry="8" strokeWidth="0.6" />
              <ellipse cx="190" cy="180" rx="22" ry="10" strokeWidth="0.6" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#topo-pattern)" />
      </svg>

      <style>{`
        @keyframes topo-drift {
          0%   { transform: translate3d(0, 0, 0); }
          50%  { transform: translate3d(-24px, -16px, 0); }
          100% { transform: translate3d(0, 0, 0); }
        }
      `}</style>
    </>
  );
}
