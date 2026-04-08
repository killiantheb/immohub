"use client"

import Marquee from "react-fast-marquee"
import { MARQUEE_ITEMS } from "@/lib/data/landing"

const C = {
  gold: "#C9A96E",
  textMuted: "rgba(255,255,255,0.45)",
  border: "rgba(255,255,255,0.06)",
} as const

export function SocialProof() {
  return (
    <div
      style={{
        background: "#111111",
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "1.125rem 0",
        overflow: "hidden",
      }}
    >
      <Marquee
        gradient
        gradientColor="#111111"
        gradientWidth={120}
        speed={38}
        pauseOnHover
      >
        {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
          <span
            key={`${item}-${i}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "1.75rem",
              marginRight: "1.75rem",
            }}
          >
            <span
              style={{
                color: C.textMuted,
                fontSize: "0.8125rem",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                whiteSpace: "nowrap",
              }}
            >
              {item}
            </span>
            <span
              style={{
                color: C.gold,
                fontSize: "0.5rem",
                opacity: 0.6,
              }}
            >
              ◆
            </span>
          </span>
        ))}
      </Marquee>
    </div>
  )
}
