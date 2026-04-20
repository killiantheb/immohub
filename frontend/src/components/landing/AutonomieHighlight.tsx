"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { C } from "@/lib/design-tokens"
import { PLAN_AUTONOMIE } from "@/lib/plans.config"

const goldBorder = "rgba(201,169,97,0.32)"

function CheckIcon({ accent = C.gold }: { accent?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7.5" stroke={accent} strokeOpacity="0.35" />
      <path d="M5 8l2.5 2.5L11 5.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AutonomieHighlight() {
  return (
    <section
      id="autonomie"
      style={{
        background: C.goldBg,
        padding: "6rem 1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: -120, right: -120,
        width: 400, height: 400, borderRadius: "50%",
        background: `radial-gradient(circle, ${C.gold}22 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: "3rem" }}
        >
          <div style={{
            display: "inline-block", padding: "0.35rem 0.85rem", borderRadius: 100,
            background: C.gold, color: "#fff",
            fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", marginBottom: "1.5rem",
          }}>
            ★ Pour quitter son agence
          </div>

          <h2 style={{
            fontFamily: "var(--font-serif)",
            color: C.text, fontSize: "clamp(1.75rem, 4vw, 3rem)",
            fontWeight: 400, lineHeight: 1.15, letterSpacing: "-0.02em",
            margin: "0 0 1rem",
          }}>
            Votre agence coûte CHF 2&apos;300/an.
            <br />
            <span style={{ color: C.gold }}>Althy Autonomie coûte CHF 468.</span>
          </h2>

          <p style={{
            color: C.text2, fontSize: "1.0625rem", lineHeight: 1.6,
            margin: "0 auto", maxWidth: 640,
          }}>
            Tous les outils d&apos;une agence professionnelle, pour 10 fois moins cher.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.15 }}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            background: C.surface,
            borderRadius: "1.25rem",
            padding: "1.75rem",
            border: `1px solid ${C.border}`,
            marginBottom: "3rem",
            maxWidth: 720,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "0.7rem", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              Avec une régie classique
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "1.75rem", color: C.text, fontWeight: 700, lineHeight: 1, fontFamily: "var(--font-serif)" }}>
              CHF 2&apos;300<span style={{ fontSize: "0.9rem", color: C.textMuted, fontWeight: 400 }}>/an</span>
            </p>
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.78rem", color: C.textMuted }}>
              8 % de loyer (CHF 2&apos;400/mois)
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.7rem", color: C.gold, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              Avec Althy Autonomie
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "1.75rem", color: C.gold, fontWeight: 700, lineHeight: 1, fontFamily: "var(--font-serif)" }}>
              CHF 468<span style={{ fontSize: "0.9rem", color: C.textMuted, fontWeight: 400 }}>/an</span>
            </p>
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.78rem", color: C.textMuted }}>
              CHF 39/mois + 3 % transit loyer
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.25 }}
          style={{
            background: C.surface,
            border: `1px solid ${goldBorder}`,
            borderRadius: "1.25rem",
            padding: "2rem",
            maxWidth: 720,
            margin: "0 auto 2.5rem",
          }}
        >
          <p style={{
            color: C.text, fontSize: "0.9rem", fontWeight: 600,
            margin: "0 0 1.25rem", letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}>
            Ce qui est inclus
          </p>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "0.875rem",
          }}>
            {PLAN_AUTONOMIE.fonctionnalites.map((feat) => (
              <div key={feat} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                <CheckIcon accent={C.gold} />
                <span style={{ color: C.text2, fontSize: "0.875rem", lineHeight: 1.5 }}>{feat}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.35 }}
          style={{ textAlign: "center" }}
        >
          <Link
            href="/autonomie"
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              background: C.gold, color: "#fff",
              padding: "1rem 2rem", borderRadius: "100px",
              fontSize: "1rem", fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 8px 24px rgba(201,169,97,0.28)",
              transition: "transform 0.2s, opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.92"
              e.currentTarget.style.transform = "translateY(-2px)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1"
              e.currentTarget.style.transform = "translateY(0)"
            }}
          >
            Découvrir Althy Autonomie →
          </Link>
          <p style={{
            color: C.textMuted, fontSize: "0.8125rem",
            margin: "1rem 0 0", fontStyle: "italic",
          }}>
            Résiliable à tout moment · Support humain inclus
          </p>
        </motion.div>
      </div>
    </section>
  )
}
