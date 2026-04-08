"use client"

import { motion } from "framer-motion"
import Link from "next/link"

const C = {
  bg: "#FAF8F4",
  border: "rgba(232,96,44,0.18)",
  text: "#1A1208",
  textMid: "rgba(26,18,8,0.65)",
  gold: "#E8602C",
  goldBorder: "rgba(232,96,44,0.22)",
} as const

export function CTAFinal() {
  return (
    <section
      style={{
        background: C.bg,
        padding: "7rem 1.5rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative border */}
      <div
        style={{
          position: "absolute",
          inset: "2rem",
          border: `1px solid ${C.border}`,
          borderRadius: "1.5rem",
          pointerEvents: "none",
        }}
      />

      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "600px",
          height: "400px",
          background: "radial-gradient(ellipse, rgba(201,169,110,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: 700,
          margin: "0 auto",
          textAlign: "center",
          position: "relative",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: "1.25rem" }}
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
            Commencer maintenant
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.1 }}
          style={{
            color: C.text,
            fontSize: "clamp(2.25rem, 5vw, 3.75rem)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            margin: "0 0 1.25rem 0",
          }}
        >
          Prêt à laisser{" "}
          <span style={{ color: C.orange }}>Althy gérer</span> ?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            color: C.textMid,
            fontSize: "1.0625rem",
            lineHeight: 1.65,
            margin: "0 0 3rem 0",
            maxWidth: 520,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Rejoignez des centaines de professionnels qui ont repris le contrôle de leur temps.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "1rem",
          }}
        >
          <Link
            href="/app"
            style={{
              background: C.gold,
              color: "#000000",
              textDecoration: "none",
              fontSize: "1rem",
              fontWeight: 700,
              padding: "0.9rem 2.25rem",
              borderRadius: "100px",
              display: "inline-block",
              transition: "opacity 0.2s, transform 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.88"
              e.currentTarget.style.transform = "translateY(-1px)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1"
              e.currentTarget.style.transform = "translateY(0)"
            }}
          >
            Démarrer gratuitement
          </Link>
          <Link
            href="/contact"
            style={{
              color: C.text,
              textDecoration: "none",
              fontSize: "1rem",
              fontWeight: 500,
              padding: "0.9rem 2.25rem",
              borderRadius: "100px",
              border: "1px solid rgba(26,18,8,0.18)",
              display: "inline-block",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(26,18,8,0.18)")}
          >
            Nous contacter
          </Link>
        </motion.div>

        {/* Trust note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{
            color: "rgba(255,255,255,0.30)",
            fontSize: "0.8125rem",
            marginTop: "2rem",
          }}
        >
          14 jours d&apos;essai · Sans carte de crédit · Annulable à tout moment
        </motion.p>
      </div>
    </section>
  )
}
