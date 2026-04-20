"use client"

import dynamic from "next/dynamic"
import { MARQUEE_ITEMS } from "@/lib/data/landing"
import { C } from "@/lib/design-tokens"

const Marquee = dynamic(() => import("react-fast-marquee"), { ssr: false })

// Cette bannière a un fond légèrement plus sombre pour le contraste
const sectionBg = C.surface2

export function SocialProof() {
  return (
    <div
      style={{
        background: sectionBg,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "1.125rem 0",
        overflow: "hidden",
      }}
    >
      <Marquee
        gradient
        gradientColor="#FAF9F6"
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
                color: C.prussian,
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
