"use client"

import Marquee from "react-fast-marquee"
import { MARQUEE_ITEMS } from "@/lib/data/landing"

const C = {
  orange: "#E8602C",
  textMuted: "rgba(26,18,8,0.40)",
  border: "rgba(40,18,8,0.06)",
  bg: "#F2EDE5",
} as const

export function SocialProof() {
  return (
    <div
      style={{
        background: C.bg,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "1.125rem 0",
        overflow: "hidden",
      }}
    >
      <Marquee
        gradient
        gradientColor="#F2EDE5"
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
                color: C.orange,
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
