"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { C } from "@/lib/design-tokens"

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
          border: `1px solid ${C.prussianBorder}`,
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
          background: "radial-gradient(ellipse, rgba(15,46,76,0.06) 0%, transparent 70%)",
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
              color: C.prussian,
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
          Commencez à gérer votre bien{" "}
          <span style={{ color: C.prussian }}>sans agence</span>
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
            margin: "0 auto 3rem auto",
            maxWidth: 520,
          }}
        >
          Gratuit pendant 30 jours. Sans carte bancaire. Sans engagement.
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
            href="/register"
            style={{
              background: C.prussian,
              color: "var(--althy-surface)",
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
            Commencer gratuitement
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
              border: `1px solid ${C.border}`,
              display: "inline-block",
              transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.prussianBorder)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}
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
            color: C.textMuted,
            fontSize: "0.8125rem",
            marginTop: "2rem",
          }}
        >
          Plateforme suisse romande — 100% sécurisée
        </motion.p>
      </div>
    </section>
  )
}
