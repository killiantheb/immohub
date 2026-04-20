"use client"

import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { PLANS_PROPRIO, PLANS_AGENCE } from "@/lib/plans.config"
import type { Plan } from "@/lib/plans.config"
import { C } from "@/lib/design-tokens"
import Link from "next/link"

const prussianBorder = "rgba(15,46,76,0.22)"
const goldBorder = "rgba(201,169,97,0.32)"

function CheckIcon({ accent = C.prussian }: { accent?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7.5" stroke={accent} strokeOpacity="0.35" />
      <path d="M5 8l2.5 2.5L11 5.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlanCard({ plan, i, accent = C.prussian, registerHref }: {
  plan: Plan
  i: number
  accent?: string
  registerHref: string
}) {
  const t = useTranslations("pricing")
  const border = accent === C.gold ? goldBorder : prussianBorder
  const bg = accent === C.gold ? C.goldBg : C.prussianBg
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.12 }}
      style={{
        background: plan.vedette ? bg : C.surface,
        border: plan.vedette ? `1px solid ${border}` : `1px solid ${C.border}`,
        borderRadius: "1.25rem",
        padding: "2.25rem",
        position: "relative",
        transform: plan.vedette ? "scale(1.02)" : "scale(1)",
        boxShadow: plan.vedette
          ? (accent === C.gold ? "0 8px 32px rgba(201,169,97,0.15)" : "0 8px 32px rgba(15,46,76,0.12)")
          : C.shadow,
      }}
    >
      {plan.vedette && (
        <div style={{
          position: "absolute", top: "-1px", left: "50%",
          transform: "translateX(-50%) translateY(-50%)",
          background: accent, color: "var(--althy-surface)",
          fontSize: "0.65rem", fontWeight: 700,
          padding: "0.3rem 0.9rem", borderRadius: "100px",
          letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap",
        }}>
          {plan.badge ?? t("popular")}
        </div>
      )}

      <div style={{ color: accent, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
        {plan.nom}
      </div>
      <p style={{ color: C.textMuted, fontSize: "0.8125rem", margin: "0 0 1.25rem", lineHeight: 1.4 }}>
        {plan.description}
      </p>

      <div style={{ marginBottom: "0.5rem" }}>
        <span style={{ color: C.text, fontSize: "3rem", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em" }}>
          {plan.prix === 0 ? t("free") : `CHF ${plan.prix}`}
        </span>
      </div>
      <div style={{ color: C.textMuted, fontSize: "0.8125rem", marginBottom: "2rem" }}>
        {plan.prix === 0 ? t("freeSubtitle") : plan.periode}
      </div>

      <Link
        href={registerHref}
        style={{
          display: "block", textAlign: "center",
          background: plan.vedette ? accent : "transparent",
          color: plan.vedette ? "var(--althy-surface)" : C.text,
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
            <CheckIcon accent={accent} />
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
  )
}

export function Tarifs() {
  const t = useTranslations("pricing")
  // 4 cards proprio sur la landing : gratuit, starter (A1), pro (A2), proprio_pro (A3)
  const proprioCards = PLANS_PROPRIO

  return (
    <section id="tarifs" style={{ background: C.bg, padding: "7rem 1.5rem" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>

        {/* Label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5 }}
          style={{ marginBottom: "1.25rem", textAlign: "center" }}
        >
          <span style={{ color: C.prussian, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase" }}>
            {t("labelProprio")}
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{ color: C.text, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", margin: "0 0 0.875rem 0", textAlign: "center" }}
        >
          {t("titleProprio")}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}
          style={{ color: C.textMuted, fontSize: "0.9375rem", textAlign: "center", margin: "0 0 4rem 0", letterSpacing: "0.02em" }}
        >
          {t("subtitleProprio")}
        </motion.p>

        {/* Cards proprio — 4 paliers (gratuit + A1 + A2 + A3) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", alignItems: "start" }}>
          {proprioCards.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              i={i}
              accent={C.prussian}
              registerHref={plan.prix === 0
                ? "/register?role=proprio_solo"
                : `/register?role=proprio_solo&plan=${plan.id}`}
            />
          ))}
        </div>

        {/* Proprio Pro mention ligne + lien vers Autonomie */}
        <motion.p
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}
          style={{
            color: C.textMuted, fontSize: "0.9375rem",
            textAlign: "center", margin: "2.5rem 0 0", lineHeight: 1.65,
          }}
        >
          {t("autonomieLine")}{" "}
          <Link href="/autonomie" style={{ color: C.gold, fontWeight: 700, textDecoration: "none" }}>
            {t("autonomieLink")}
          </Link>
        </motion.p>

        {/* ─────────────────────────────────────────────────────────────────────
             Section agence (A5 + A7)
           ───────────────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }}
          style={{ marginTop: "6rem", textAlign: "center", marginBottom: "3rem" }}
        >
          <span style={{ color: C.prussian, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase" }}>
            {t("labelAgence")}
          </span>
          <h3 style={{ color: C.text, fontSize: "clamp(1.6rem, 3vw, 2.25rem)", fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em", margin: "0.875rem 0 0.5rem" }}>
            {t("titleAgence")}
          </h3>
          <p style={{ color: C.textMuted, fontSize: "0.95rem", margin: 0 }}>
            {t("subtitleAgence")}
          </p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem", alignItems: "start" }}>
          {PLANS_AGENCE.map((plan, i) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              i={i}
              accent={plan.id === "enterprise" ? C.gold : C.prussian}
              registerHref="/contact?source=agence"
            />
          ))}
        </div>

        {/* Footer disclaimer */}
        <motion.p
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.5 }}
          style={{ color: C.textMuted, fontSize: "0.8rem", textAlign: "center", marginTop: "3rem", lineHeight: 1.7 }}
        >
          {t("disclaimer")}
        </motion.p>
      </div>
    </section>
  )
}
