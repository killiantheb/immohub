"use client"

import { motion } from "framer-motion"
import { PLANS } from "@/lib/data/landing"
import Link from "next/link"

const C = {
  bg: "#1A1208",
  surface: "#1A1208",
  surface2: "#F2EDE5",
  border: "rgba(26,18,8,0.08)",
  text: "#1A1208",
  textMid: "rgba(26,18,8,0.65)",
  textMuted: "rgba(26,18,8,0.38)",
  gold: "#E8602C",
  goldBg: "rgba(232,96,44,0.05)",
  goldBorder: "rgba(232,96,44,0.28)",
} as const

function CheckIcon({ small = false }: { small?: boolean }) {
  const size = small ? 14 : 16
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7.5" stroke={C.gold} strokeOpacity="0.3" />
      <path d="M5 8l2.5 2.5L11 5.5" stroke={C.gold} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Tarifs() {
  return (
    <section
      id="tarifs"
      style={{ background: "#FAF8F4", padding: "7rem 1.5rem" }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: "1.25rem", textAlign: "center" }}
        >
          <span
            style={{
              color: C.orange,
              fontSize: "0.75rem",
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Tarifs
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            color: C.text,
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: "0 0 0.875rem 0",
            textAlign: "center",
          }}
        >
          Simple. Transparent. Sans surprise.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{
            color: C.textMuted,
            fontSize: "0.9375rem",
            textAlign: "center",
            margin: "0 0 4rem 0",
            letterSpacing: "0.02em",
          }}
        >
          14 jours gratuits · Pas de carte de crédit · Sans engagement
        </motion.p>

        {/* Cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1rem",
            alignItems: "start",
          }}
        >
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.12 }}
              style={{
                background: plan.featured ? C.goldBg : C.surface,
                border: `1px solid ${C.orangeBorder}`}` : `1px solid ${C.border}`,
                borderRadius: "1.25rem",
                padding: "2.25rem",
                position: "relative",
                transform: plan.featured ? "scale(1.02)" : "scale(1)",
              }}
            >
              {/* Featured badge */}
              {plan.badge && (
                <div
                  style={{
                    position: "absolute",
                    top: "-1px",
                    left: "50%",
                    transform: "translateX(-50%) translateY(-50%)",
                    background: C.gold,
                    color: "#000000",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "0.3rem 0.9rem",
                    borderRadius: "100px",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {plan.badge}
                </div>
              )}

              {/* Plan name */}
              <div
                style={{
                  color: C.orange,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  marginBottom: "1.25rem",
                }}
              >
                {plan.name}
              </div>

              {/* Price */}
              <div style={{ marginBottom: "0.5rem" }}>
                <span style={{ color: C.text, fontSize: "3rem", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {plan.currency} {plan.price}
                </span>
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.50)",
                  fontSize: "0.8125rem",
                  marginBottom: "2rem",
                }}
              >
                {plan.period}
              </div>

              {/* CTA */}
              <Link
                href="/app"
                style={{
                  display: "block",
                  textAlign: "center",
                  background: plan.featured ? C.gold : "transparent",
                  color: plan.featured ? "#000000" : C.text,
                  border: plan.featured ? "none" : `1px solid rgba(255,255,255,0.20)`,
                  borderRadius: "100px",
                  padding: "0.75rem 1.5rem",
                  fontSize: "0.9375rem",
                  fontWeight: plan.featured ? 700 : 500,
                  textDecoration: "none",
                  marginBottom: "2rem",
                  transition: "opacity 0.2s, background 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (plan.featured) {
                    e.currentTarget.style.opacity = "0.85"
                  } else {
                    e.currentTarget.style.background = "rgba(26,18,8,0.06)"
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1"
                  if (!plan.featured) {
                    e.currentTarget.style.background = "transparent"
                  }
                }}
              >
                {plan.cta}
              </Link>

              {/* Divider */}
              <div style={{ height: 1, background: C.border, marginBottom: "1.5rem" }} />

              {/* Features list */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {plan.features.map((feat) => (
                  <div key={feat} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <CheckIcon />
                    <span style={{ color: "rgba(255,255,255,0.70)", fontSize: "0.875rem", lineHeight: 1.5 }}>
                      {feat}
                    </span>
                  </div>
                ))}
              </div>

              {/* Note */}
              {plan.note && (
                <p
                  style={{
                    color: "rgba(255,255,255,0.35)",
                    fontSize: "0.75rem",
                    fontStyle: "italic",
                    marginTop: "1.5rem",
                    lineHeight: 1.5,
                  }}
                >
                  {plan.note}
                </p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{
            color: "rgba(255,255,255,0.35)",
            fontSize: "0.8rem",
            textAlign: "center",
            marginTop: "2.5rem",
            lineHeight: 1.7,
          }}
        >
          Tous les prix sont en CHF, TVA non applicable (art. 10 LTVA). Commission Ouvreur/Artisan prélevée uniquement sur missions conclues.
        </motion.p>
      </div>
    </section>
  )
}
