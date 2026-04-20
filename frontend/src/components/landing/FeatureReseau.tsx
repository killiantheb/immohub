"use client"

import { motion } from "framer-motion"
import { OUVREUR_FEATURES, ARTISAN_FEATURES } from "@/lib/data/landing"
import { C } from "@/lib/design-tokens"

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7.5" stroke={C.orange} strokeOpacity="0.35" />
      <path d="M5 8l2.5 2.5L11 5.5" stroke={C.orange} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface FeatureColumnProps {
  icon: string
  title: string
  subtitle: string
  features: string[]
  delay?: number
}

function FeatureColumn({ icon, title, subtitle, features, delay = 0 }: FeatureColumnProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: "1.25rem",
        padding: "2.25rem",
        flex: 1,
        boxShadow: "0 2px 12px rgba(40,18,8,0.06)",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "0.75rem",
          background: C.orangeBg,
          border: `1px solid ${C.orangeBorder}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.375rem",
          marginBottom: "1.5rem",
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          color: C.text,
          fontSize: "1.25rem",
          fontWeight: 700,
          margin: "0 0 0.5rem 0",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: C.textMuted,
          fontSize: "0.875rem",
          margin: "0 0 1.75rem 0",
          lineHeight: 1.6,
        }}
      >
        {subtitle}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {features.map((feat) => (
          <div key={feat} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <CheckIcon />
            <span style={{ color: C.textMid, fontSize: "0.9rem", lineHeight: 1.5 }}>
              {feat}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export function FeatureReseau() {
  return (
    <section style={{ background: C.bg, padding: "7rem 1.5rem" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* Header */}
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
            Réseau d&apos;intervenants
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            color: C.text,
            fontSize: "clamp(2rem, 4vw, 2.75rem)",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            margin: "0 0 3.5rem 0",
            maxWidth: 600,
          }}
        >
          Votre réseau.{" "}
          <span style={{ color: C.orange }}>Géolocalisé et automatisé.</span>
        </motion.h2>

        {/* 2-col cards */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          className="md:flex-row"
        >
          <FeatureColumn
            icon="🔧"
            title="Ouvreurs"
            subtitle="Intervenants de premier niveau disponibles dans votre zone, en quelques minutes."
            features={OUVREUR_FEATURES}
            delay={0}
          />
          <FeatureColumn
            icon="🏗️"
            title="Artisans"
            subtitle="Des spécialistes qualifiés pour chaque corps de métier, avec devis automatique."
            features={ARTISAN_FEATURES}
            delay={0.15}
          />
        </div>

        {/* Swiss map card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          style={{ marginTop: "1rem" }}
        >
          <div
            style={{
              background: C.surface2,
              border: `1px solid ${C.border}`,
              borderRadius: "1.25rem",
              padding: "2.5rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "1.5rem",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(ellipse at center, rgba(15,46,76,0.04) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.875rem",
                flexWrap: "wrap",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {["Genève", "Lausanne", "Vaud", "Valais", "Neuchâtel", "Fribourg"].map((canton, i) => (
                <div
                  key={canton}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: C.orange,
                      opacity: 0.7 - i * 0.08,
                      boxShadow: `0 0 8px ${C.orange}`,
                    }}
                  />
                  <span style={{ color: C.textMid, fontSize: "0.875rem" }}>{canton}</span>
                </div>
              ))}
            </div>

            <div>
              <div
                style={{
                  background: C.orangeBg,
                  border: `1px solid ${C.orangeBorder}`,
                  borderRadius: "0.625rem",
                  padding: "0.75rem 1.5rem",
                  display: "inline-block",
                }}
              >
                <span style={{ color: C.orange, fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em" }}>
                  Suisse Romande — missions actives
                </span>
              </div>
              <p style={{ color: C.textMuted, fontSize: "0.8125rem", marginTop: "0.75rem" }}>
                Couverture en expansion · Bientôt en Suisse alémanique
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
