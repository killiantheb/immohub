"use client"

import { motion } from "framer-motion"
import { PLANS } from "@/lib/plans.config"
import Link from "next/link"

const C = {
  bg: "#FAF8F4",
  surface: "#FFFFFF",
  surface2: "#F2EDE5",
  border: "rgba(40,18,8,0.08)",
  text: "#1A1208",
  textMid: "rgba(26,18,8,0.65)",
  textMuted: "rgba(26,18,8,0.38)",
  orange: "#E8602C",
  orangeBg: "rgba(232,96,44,0.08)",
  orangeBorder: "rgba(232,96,44,0.22)",
} as const

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7.5" stroke={C.orange} strokeOpacity="0.35" />
      <path d="M5 8l2.5 2.5L11 5.5" stroke={C.orange} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Tarifs() {
  return (
    <section id="tarifs" style={{ background: C.bg, padding: "7rem 1.5rem" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>

        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          style={{ marginBottom: "1.25rem", textAlign: "center" }}
        >
          <span style={{ color: C.orange, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase" }}>
            Tarifs
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{ color: C.text, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 0.875rem 0", textAlign: "center" }}
        >
          Simple. Transparent. Sans surprise.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}
          style={{ color: C.textMuted, fontSize: "0.9375rem", textAlign: "center", margin: "0 0 4rem 0", letterSpacing: "0.02em" }}
        >
          14 jours gratuits · Pas de carte de crédit · Sans engagement
        </motion.p>

        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", alignItems: "start" }}>
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.12 }}
              style={{
                background: plan.vedette ? C.orangeBg : C.surface,
                border: plan.vedette ? `1px solid ${C.orangeBorder}` : `1px solid ${C.border}`,
                borderRadius: "1.25rem",
                padding: "2.25rem",
                position: "relative",
                transform: plan.vedette ? "scale(1.02)" : "scale(1)",
                boxShadow: plan.vedette ? "0 8px 32px rgba(232,96,44,0.12)" : "0 2px 12px rgba(40,18,8,0.06)",
              }}
            >
              {plan.vedette && (
                <div style={{
                  position: "absolute", top: "-1px", left: "50%",
                  transform: "translateX(-50%) translateY(-50%)",
                  background: C.orange, color: "#FFFFFF",
                  fontSize: "0.65rem", fontWeight: 700,
                  padding: "0.3rem 0.9rem", borderRadius: "100px",
                  letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
                }}>
                  Le plus populaire
                </div>
              )}

              <div style={{ color: C.orange, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "1.25rem" }}>
                {plan.nom}
              </div>

              <div style={{ marginBottom: "0.5rem" }}>
                <span style={{ color: C.text, fontSize: "3rem", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em" }}>
                  {plan.prix === 0 ? "Gratuit" : `CHF ${plan.prix}`}
                </span>
              </div>
              <div style={{ color: C.textMuted, fontSize: "0.8125rem", marginBottom: "2rem" }}>
                {plan.periode}
              </div>

              <Link
                href="/register"
                style={{
                  display: "block", textAlign: "center",
                  background: plan.vedette ? C.orange : "transparent",
                  color: plan.vedette ? "#FFFFFF" : C.text,
                  border: plan.vedette ? "none" : `1px solid ${C.border}`,
                  borderRadius: "100px", padding: "0.75rem 1.5rem",
                  fontSize: "0.9375rem", fontWeight: plan.vedette ? 700 : 500,
                  textDecoration: "none", marginBottom: "2rem", transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {plan.cta}
              </Link>

              <div style={{ height: 1, background: C.border, marginBottom: "1.5rem" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {plan.fonctionnalites.map((feat) => (
                  <div key={feat} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <CheckIcon />
                    <span style={{ color: C.textMid, fontSize: "0.875rem", lineHeight: 1.5 }}>{feat}</span>
                  </div>
                ))}
              </div>

              {plan.note && (
                <p style={{ color: C.textMuted, fontSize: "0.75rem", fontStyle: "italic", marginTop: "1.5rem", lineHeight: 1.5 }}>
                  {plan.note}
                </p>
              )}
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.5 }}
          style={{ color: C.textMuted, fontSize: "0.8rem", textAlign: "center", marginTop: "2.5rem", lineHeight: 1.7 }}
        >
          Tous les prix sont en CHF, TVA non applicable (art. 10 LTVA). Commission Ouvreur/Artisan prélevée uniquement sur missions conclues.
        </motion.p>
      </div>
    </section>
  )
}
