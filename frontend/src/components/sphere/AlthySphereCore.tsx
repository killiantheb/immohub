"use client";

import { useEffect, useRef } from "react";
import type { SphereState } from "@/lib/store/sphereStore";

interface Props {
  state: SphereState;
  size?: number;
}

const STATE_CONFIG: Record<SphereState, { label: string; speed: number }> = {
  idle:      { label: "",         speed: 3 },
  listening: { label: "Écoute…",  speed: 1.2 },
  thinking:  { label: "Réfléchit…", speed: 0.8 },
  speaking:  { label: "",         speed: 2 },
};

export function AlthySphereCore({ state, size = 200 }: Props) {
  const orbitRef = useRef<SVGAnimateElement>(null);
  const { speed } = STATE_CONFIG[state];
  const r = size / 2;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
      aria-label="Sphère Althy"
      role="img"
    >
      {/* ── Glow halo ── */}
      <div
        style={{
          position: "absolute",
          inset: -size * 0.18,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(181,90,48,0.18) 0%, transparent 70%)",
          animation: `althyPulse ${speed * 1.4}s ease-in-out infinite`,
          pointerEvents: "none",
        }}
      />

      {/* ── Sphere body ── */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          {/* Main gradient — terre cuite */}
          <radialGradient id="sg-main" cx="38%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#E8835A" />
            <stop offset="45%"  stopColor="var(--althy-orange)" />
            <stop offset="100%" stopColor="#6E3018" />
          </radialGradient>

          {/* Thinking state — slightly darker */}
          <radialGradient id="sg-think" cx="38%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#C87050" />
            <stop offset="45%"  stopColor="#923E1E" />
            <stop offset="100%" stopColor="#4A1E0A" />
          </radialGradient>

          {/* Listening — brighter */}
          <radialGradient id="sg-listen" cx="38%" cy="35%" r="65%">
            <stop offset="0%"   stopColor="#F5A070" />
            <stop offset="45%"  stopColor="#D06830" />
            <stop offset="100%" stopColor="#8A3C18" />
          </radialGradient>

          {/* Drop shadow */}
          <filter id="sf-shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy={size * 0.08} stdDeviation={size * 0.06}
              floodColor="#7A3018" floodOpacity="0.35" />
          </filter>
        </defs>

        {/* Shadow ellipse */}
        <ellipse
          cx={r} cy={size * 0.94}
          rx={r * 0.7} ry={r * 0.1}
          fill="rgba(90,30,10,0.18)"
          style={{ filter: "blur(6px)" }}
        />

        {/* Main sphere */}
        <circle
          cx={r} cy={r} r={r * 0.92}
          fill={
            state === "thinking"  ? "url(#sg-think)"  :
            state === "listening" ? "url(#sg-listen)" :
            "url(#sg-main)"
          }
          filter="url(#sf-shadow)"
          style={{
            animation:
              state === "thinking"
                ? `althyPulse ${speed}s ease-in-out infinite`
                : state === "listening"
                ? `althyPulse ${speed}s ease-in-out infinite`
                : `althyFloat ${speed * 1.2}s ease-in-out infinite`,
            transformOrigin: `${r}px ${r}px`,
          }}
        />

        {/* Primary highlight */}
        <ellipse
          cx={r * 0.58} cy={r * 0.46}
          rx={r * 0.28} ry={r * 0.16}
          fill="white"
          opacity={0.28}
          style={{ transform: "rotate(-30deg)", transformOrigin: `${r * 0.58}px ${r * 0.46}px` }}
        />

        {/* Secondary soft highlight */}
        <ellipse
          cx={r * 0.52} cy={r * 0.38}
          rx={r * 0.10} ry={r * 0.06}
          fill="white"
          opacity={0.55}
          style={{ transform: "rotate(-20deg)", transformOrigin: `${r * 0.52}px ${r * 0.38}px` }}
        />

        {/* Listening — ring pulses */}
        {state === "listening" && (
          <>
            <circle cx={r} cy={r} r={r * 0.96} fill="none"
              stroke="rgba(181,90,48,0.4)" strokeWidth="2"
              style={{ animation: "althyPulse 1s ease-in-out infinite" }}
            />
            <circle cx={r} cy={r} r={r * 1.06} fill="none"
              stroke="rgba(181,90,48,0.2)" strokeWidth="1.5"
              style={{ animation: "althyPulse 1s ease-in-out infinite 0.2s" }}
            />
          </>
        )}

        {/* Thinking — orbit dot */}
        {state === "thinking" && (
          <circle cx={r} cy={r * 0.1} r={r * 0.06} fill="rgba(255,255,255,0.7)">
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={`0 ${r} ${r};360 ${r} ${r}`}
              dur="1.2s"
              repeatCount="indefinite"
            />
          </circle>
        )}
      </svg>

      {/* State label */}
      {STATE_CONFIG[state].label && (
        <div
          style={{
            position: "absolute",
            bottom: -28,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 12,
            color: "var(--althy-text-3)",
            letterSpacing: "0.04em",
            fontStyle: "italic",
            whiteSpace: "nowrap",
            animation: "fadeIn 0.3s ease",
          }}
        >
          {STATE_CONFIG[state].label}
        </div>
      )}
    </div>
  );
}
