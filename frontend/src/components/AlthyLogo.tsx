"use client";

interface AlthyLogoProps {
  size?: number;
  className?: string;
}

export function AlthyLogo({ size = 36, className = "" }: AlthyLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="sphere-main" cx="38%" cy="32%" r="65%" fx="38%" fy="32%">
          <stop offset="0%"   stopColor="#FFAB6E" />
          <stop offset="40%"  stopColor="#E8601C" />
          <stop offset="100%" stopColor="#7C2200" />
        </radialGradient>
        <radialGradient id="sphere-shine" cx="35%" cy="28%" r="40%">
          <stop offset="0%"  stopColor="#FFFFFF" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <filter id="blob-filter" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015"
            numOctaves="2"
            seed="5"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <radialGradient id="sphere-shadow" cx="50%" cy="100%" r="45%">
          <stop offset="0%"  stopColor="#7C2200" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#7C2200" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="50" cy="92" rx="28" ry="6" fill="url(#sphere-shadow)" />
      <circle
        cx="50"
        cy="48"
        r="40"
        fill="url(#sphere-main)"
        filter="url(#blob-filter)"
      />
      <ellipse
        cx="40"
        cy="32"
        rx="16"
        ry="11"
        fill="url(#sphere-shine)"
        transform="rotate(-20 40 32)"
      />
      <ellipse
        cx="58"
        cy="26"
        rx="5"
        ry="3"
        fill="white"
        opacity="0.35"
        transform="rotate(-15 58 26)"
      />
    </svg>
  );
}
