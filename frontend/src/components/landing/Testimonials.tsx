"use client"

import { motion } from "framer-motion"
import { TESTIMONIALS } from "@/lib/data/landing"

const C = {
  bg: "#1A1208",
  surface: "#1A1208",
  surface2: "#F2EDE5",
  border: "rgba(26,18,8,0.08)",
  text: "#1A1208",
  textMid: "rgba(26,18,8,0.75)",
  textMuted: "rgba(26,18,8,0.45)",
  gold: "#E8602C",
} as const

export function Testimonials() {
  return (
    <section
      style={{ background: C.bg, padding: "7rem 0" }}
    >
      {/* Header */}
      <div style={{ padding: "0 1.5rem", maxWidth: 1280, margin: "0 auto", marginBottom: "3rem" }}>
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
            Témoignages
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
            margin: 0,
          }}
        >
          Ils ont choisi{" "}
          <span style={{ color: C.orange }}>Althy.</span>
        </motion.h2>
      </div>

      {/* Horizontal scroll container */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay: 0.2 }}
        style={{
          display: "flex",
          overflowX: "auto",
          gap: "1rem",
          paddingLeft: "max(1.5rem, calc((100vw - 1280px) / 2 + 1.5rem))",
          paddingRight: "max(1.5rem, calc((100vw - 1280px) / 2 + 1.5rem))",
          paddingBottom: "1rem",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        className="hide-scrollbar"
      >
        {TESTIMONIALS.map((t) => (
          <div
            key={t.name}
            style={{
              background: "#F2EDE5",
              border: `1px solid ${C.border}`,
              borderRadius: "1rem",
              padding: "1.75rem 1.5rem",
              minWidth: 288,
              maxWidth: 320,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              transition: "border-color 0.25s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(232,96,44,0.18)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border
            }}
          >
            {/* Gold quote mark */}
            <div
              style={{
                color: C.orange,
                fontSize: "3rem",
                lineHeight: 0.8,
                fontFamily: "Georgia, serif",
                opacity: 0.6,
              }}
            >
              &ldquo;
            </div>

            {/* Quote text */}
            <p
              style={{
                color: C.textMid,
                fontSize: "0.9375rem",
                fontStyle: "italic",
                lineHeight: 1.65,
                margin: 0,
                flex: 1,
              }}
            >
              {t.quote}
            </p>

            {/* Author */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(201,169,110,0.12)",
                  border: "1px solid rgba(232,96,44,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: C.orange,
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {t.name.charAt(0)}
              </div>
              <div>
                <div style={{ color: C.text, fontSize: "0.875rem", fontWeight: 500 }}>
                  {t.name}
                </div>
                <div style={{ color: C.textMuted, fontSize: "0.75rem" }}>
                  {t.role} · {t.city}
                </div>
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </section>
  )
}
