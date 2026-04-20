"use client"

import { motion } from "framer-motion"
import { IA_QUESTIONS } from "@/lib/data/landing"
import Link from "next/link"
import { C } from "@/lib/design-tokens"

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const bubbleVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5 } },
}

export function FeatureIA() {
  return (
    <section style={{ background: C.surface2, padding: "7rem 1.5rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
        {/* Label */}
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
            Assistant IA natif
          </span>
        </motion.div>

        {/* H2 */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            color: C.text,
            fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            margin: "0 0 1.25rem 0",
          }}
        >
          Althy parle.{" "}
          <span style={{ color: C.prussian }}>Vous décidez.</span>
        </motion.h2>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            color: C.textMid,
            fontSize: "1.0625rem",
            lineHeight: 1.7,
            margin: "0 auto 3.5rem auto",
            maxWidth: 560,
          }}
        >
          Posez n&apos;importe quelle question sur votre portefeuille. Althy répond instantanément, génère les documents nécessaires et automatise les relances — en français, sans aucune formation requise.
        </motion.p>

        {/* Chat bubbles */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.75rem",
            marginBottom: "3rem",
          }}
        >
          {IA_QUESTIONS.map((q) => (
            <motion.div
              key={q}
              variants={bubbleVariants}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: "100px",
                padding: "0.625rem 1.25rem",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "default",
                transition: "border-color 0.2s, background 0.2s",
                boxShadow: "0 1px 4px rgba(40,18,8,0.06)",
              }}
              whileHover={{
                borderColor: "rgba(15,46,76,0.28)",
              }}
            >
              <span style={{ color: C.prussian, fontSize: "0.7rem", flexShrink: 0 }}>✦</span>
              <span
                style={{
                  color: C.textMid,
                  fontSize: "0.875rem",
                  whiteSpace: "nowrap",
                }}
              >
                {q}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link
            href="/register"
            style={{
              color: C.prussian,
              textDecoration: "none",
              fontSize: "1rem",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              transition: "gap 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.gap = "0.625rem")}
            onMouseLeave={(e) => (e.currentTarget.style.gap = "0.375rem")}
          >
            Essayer Althy IA →
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
