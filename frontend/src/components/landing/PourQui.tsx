"use client"

import { motion } from "framer-motion"
import { POUR_QUI } from "@/lib/data/landing"

const C = {
  bg: "#FAF8F4",
  surface: "#FFFFFF",
  border: "rgba(40,18,8,0.08)",
  text: "#1A1208",
  textMid: "rgba(26,18,8,0.60)",
  textMuted: "rgba(26,18,8,0.38)",
  orange: "var(--althy-orange)",
  orangeBg: "rgba(232,96,44,0.08)",
  orangeBorder: "rgba(232,96,44,0.22)",
} as const

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
}

export function PourQui() {
  return (
    <section
      id="pour-qui"
      style={{ background: C.bg, padding: "7rem 1.5rem" }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
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
              color: C.orange,
              fontSize: "0.75rem",
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Pour qui
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
            margin: "0 0 3.5rem 0",
            maxWidth: 560,
          }}
        >
          Un espace dédié pour chaque profil
        </motion.h2>

        {/* Cards grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {POUR_QUI.map((item, index) => (
            <motion.div
              key={item.label}
              variants={cardVariants}
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: "1rem",
                padding: "2rem",
                position: "relative",
                cursor: "default",
                transition: "border-color 0.25s",
                boxShadow: "0 2px 12px rgba(40,18,8,0.05)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.orangeBorder
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.border
              }}
            >
              {/* Number badge */}
              <div
                style={{
                  position: "absolute",
                  top: "1.25rem",
                  right: "1.25rem",
                  color: C.orange,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  opacity: 0.35,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </div>

              {/* Label */}
              <h3
                style={{
                  color: C.text,
                  fontWeight: 500,
                  fontSize: "1.0625rem",
                  margin: "0 0 0.625rem 0",
                  paddingRight: "2rem",
                }}
              >
                {item.label}
              </h3>

              {/* Description */}
              <p
                style={{
                  color: C.textMid,
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  margin: "0 0 1.5rem 0",
                }}
              >
                {item.desc}
              </p>

              {/* Arrow */}
              <span
                style={{
                  color: C.orange,
                  fontSize: "1.1rem",
                  position: "absolute",
                  bottom: "1.5rem",
                  right: "1.5rem",
                }}
              >
                →
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
