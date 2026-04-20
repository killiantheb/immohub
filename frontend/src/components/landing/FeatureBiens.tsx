"use client"

import { motion } from "framer-motion"
import { FEATURES_BIENS } from "@/lib/data/landing"
import { C } from "@/lib/design-tokens"

// Cette section a un fond légèrement plus sombre pour l'alternance visuelle
const sectionBg = C.surface2

const MOCK_BIENS = [
  { adresse: "Rue de Rive 12", ville: "Genève", loyer: "2 400", statut: "Loué", color: "var(--althy-green)" },
  { adresse: "Av. de la Gare 8", ville: "Lausanne", loyer: "1 850", statut: "Loué", color: "var(--althy-green)" },
  { adresse: "Chemin des Fleurs 4", ville: "Nyon", loyer: "1 600", statut: "Vacant", color: "#8A5210" },
  { adresse: "Grand-Rue 21", ville: "Sion", loyer: "1 200", statut: "Loué", color: "var(--althy-green)" },
]

export function FeatureBiens() {
  return (
    <section
      id="features"
      style={{ background: sectionBg, padding: "7rem 1.5rem" }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "4rem",
          alignItems: "center",
        }}
        className="lg:grid-cols-2"
      >
        {/* Left: text */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <span
            style={{
              color: C.prussian,
              fontSize: "0.75rem",
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              display: "block",
              marginBottom: "1.25rem",
            }}
          >
            Tableau de bord propriétaire
          </span>

          <h2
            style={{
              color: C.text,
              fontSize: "clamp(2rem, 4vw, 2.75rem)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              margin: "0 0 3rem 0",
            }}
          >
            Tous vos biens.{" "}
            <span style={{ color: C.prussian }}>Un seul endroit.</span>
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            {FEATURES_BIENS.map((feat, i) => (
              <div key={feat.title} style={{ display: "flex", gap: "1.25rem" }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: C.prussianBg,
                    border: `1px solid ${C.prussianBorder}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: C.prussian,
                    letterSpacing: "0.05em",
                    marginTop: "0.1rem",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <div
                    style={{
                      color: C.text,
                      fontWeight: 500,
                      fontSize: "1rem",
                      marginBottom: "0.35rem",
                    }}
                  >
                    {feat.title}
                  </div>
                  <div
                    style={{
                      color: C.textMid,
                      fontSize: "0.875rem",
                      lineHeight: 1.65,
                    }}
                  >
                    {feat.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: "1.25rem",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(40,18,8,0.10), 0 2px 8px rgba(40,18,8,0.06)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: C.bg,
              }}
            >
              <span style={{ color: C.textMuted, fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Mes biens
              </span>
              <span
                style={{
                  background: C.prussianBg,
                  color: C.prussian,
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  padding: "0.25rem 0.625rem",
                  borderRadius: "100px",
                  border: `1px solid ${C.prussianBorder}`,
                }}
              >
                4 biens
              </span>
            </div>

            {/* Summary stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              {[
                { label: "Loyers / mois", val: "CHF 7 050" },
                { label: "Taux d'occupation", val: "75%" },
                { label: "Docs générés", val: "12" },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    padding: "0.875rem 1rem",
                    borderRight: `1px solid ${C.border}`,
                  }}
                >
                  <div style={{ color: C.textMuted, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>
                    {s.label}
                  </div>
                  <div style={{ color: C.prussian, fontSize: "0.9rem", fontWeight: 700 }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Bien rows */}
            <div style={{ padding: "0.75rem" }}>
              {MOCK_BIENS.map((bien) => (
                <div
                  key={bien.adresse}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 0.875rem",
                    borderRadius: "0.625rem",
                    marginBottom: "0.375rem",
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.textMid, fontSize: "0.75rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {bien.adresse}
                    </div>
                    <div style={{ color: C.textMuted, fontSize: "0.65rem" }}>{bien.ville}</div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.6rem",
                      fontWeight: 600,
                      color: bien.color,
                      background: `${bien.color}1a`,
                      padding: "0.2rem 0.5rem",
                      borderRadius: "100px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {bien.statut}
                  </span>
                  <span style={{ color: C.prussian, fontSize: "0.75rem", fontWeight: 700, flexShrink: 0 }}>
                    CHF {bien.loyer}
                  </span>
                </div>
              ))}
            </div>

            {/* AI bar */}
            <div
              style={{
                margin: "0 0.75rem 0.75rem",
                padding: "0.75rem 1rem",
                background: C.prussianBg,
                borderRadius: "0.75rem",
                border: `1px solid ${C.prussianBorder}`,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ color: C.prussian, fontSize: "0.8rem" }}>✦</span>
              <span style={{ color: C.textMuted, fontSize: "0.7rem" }}>
                &ldquo;Relance automatique envoyée pour Chemin des Fleurs 4 — 3 jours de retard&rdquo;
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
