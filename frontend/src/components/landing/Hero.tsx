"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { AlthySphere } from "@/components/AlthySphere"

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

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
}

const BIENS = [
  { adresse: "Rue de Rive 12, Genève", statut: "Loué", loyer: "CHF 2 400", color: "#2E5E22" },
  { adresse: "Av. de la Gare 8, Lausanne", statut: "Loué", loyer: "CHF 1 850", color: "#2E5E22" },
  { adresse: "Chemin des Fleurs 4, Nyon", statut: "Vacant", loyer: "CHF 1 600", color: "#8A5210" },
  { adresse: "Grand-Rue 21, Sion", statut: "Loué", loyer: "CHF 1 200", color: "#2E5E22" },
]

export function Hero() {
  return (
    <section
      style={{
        background: C.bg,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        paddingTop: "80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle orange glow */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "5%",
          width: "600px",
          height: "600px",
          background: "radial-gradient(ellipse, rgba(232,96,44,0.05) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "4rem 1.5rem",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "3rem",
          alignItems: "center",
        }}
        className="lg:grid-cols-2"
      >
        {/* Left: text */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}
        >
          {/* Sphère + badge */}
          <motion.div variants={fadeUp} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <AlthySphere size={56} />
            <span
              style={{
                color: C.orange,
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: C.orangeBg,
                border: `1px solid ${C.orangeBorder}`,
                padding: "0.35rem 0.9rem",
                borderRadius: "100px",
              }}
            >
              Assistant immobilier suisse
            </span>
          </motion.div>

          {/* H1 */}
          <motion.div variants={fadeUp}>
            <h1
              style={{
                fontSize: "clamp(3rem, 6.5vw, 5rem)",
                fontWeight: 700,
                lineHeight: 1.06,
                margin: 0,
                letterSpacing: "-0.02em",
                fontFamily: "var(--font-sans), Inter, sans-serif",
              }}
            >
              <span style={{ color: C.text, display: "block" }}>Gérez vos biens.</span>
              <span style={{ color: C.orange, display: "block" }}>Althy fait le reste.</span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            style={{ color: C.textMid, fontSize: "1.125rem", maxWidth: 480, lineHeight: 1.65, margin: 0 }}
          >
            L&apos;assistant immobilier suisse — loyers, locataires, ouvreurs, artisans. Tout automatisé, tout centralisé, 24h/24.
          </motion.p>

          {/* Stats */}
          <motion.div
            variants={fadeUp}
            style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem", color: C.orange, fontSize: "0.9rem", fontWeight: 600 }}
          >
            {["180 biens actifs", "100+ visites/mois", "CHF 29 / mois"].map((stat, i) => (
              <span key={stat} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {i > 0 && <span style={{ color: C.orange, opacity: 0.35 }}>·</span>}
                {stat}
              </span>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div variants={fadeUp} style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
            <Link
              href="/app"
              style={{
                background: C.orange,
                color: "#FFFFFF",
                textDecoration: "none",
                fontSize: "1rem",
                fontWeight: 600,
                padding: "0.875rem 2rem",
                borderRadius: "100px",
                display: "inline-block",
                transition: "opacity 0.2s, transform 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.87"; e.currentTarget.style.transform = "translateY(-1px)" }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)" }}
            >
              Démarrer gratuitement
            </Link>
            <a
              href="#features"
              style={{ color: C.orange, textDecoration: "none", fontSize: "1rem", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: "0.375rem", transition: "gap 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.gap = "0.625rem")}
              onMouseLeave={(e) => (e.currentTarget.style.gap = "0.375rem")}
            >
              Voir comment ça marche →
            </a>
          </motion.div>
        </motion.div>

        {/* Right: dashboard mockup */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="hidden lg:block"
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
            {/* Header bar */}
            <div
              style={{
                padding: "0.875rem 1.25rem",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: C.surface2,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <AlthySphere size={20} />
                <span style={{ fontFamily: "var(--font-serif)", color: C.orange, fontSize: "1rem", fontWeight: 500, letterSpacing: "0.12em" }}>
                  Althy
                </span>
                <span style={{ color: C.textMuted, fontSize: "0.72rem" }}>Dashboard</span>
              </div>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                  <div key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
                ))}
              </div>
            </div>

            {/* Sidebar + content */}
            <div style={{ display: "flex" }}>
              <div
                style={{
                  width: 54,
                  background: C.surface2,
                  borderRight: `1px solid ${C.border}`,
                  padding: "1rem 0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1.25rem",
                }}
              >
                {[C.orange, C.textMuted, C.textMuted, C.textMuted, C.textMuted].map((color, i) => (
                  <div key={i} style={{ width: 18, height: 18, borderRadius: 4, background: color === C.orange ? C.orangeBg : "transparent", border: `1px solid ${color === C.orange ? C.orangeBorder : C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 8, height: 1, background: color, borderRadius: 1 }} />
                  </div>
                ))}
              </div>

              <div style={{ flex: 1, padding: "1.25rem" }}>
                <div style={{ fontSize: "0.68rem", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
                  Mes biens — Avril 2026
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "0.5rem", padding: "0.4rem 0.75rem", marginBottom: "0.25rem", fontSize: "0.62rem", color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  <span>Adresse</span><span>Statut</span><span>Loyer</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  {BIENS.map((bien) => (
                    <div
                      key={bien.adresse}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        gap: "0.75rem",
                        alignItems: "center",
                        padding: "0.6rem 0.75rem",
                        background: C.surface2,
                        borderRadius: "0.5rem",
                        border: `1px solid ${C.border}`,
                      }}
                    >
                      <span style={{ fontSize: "0.68rem", color: C.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {bien.adresse}
                      </span>
                      <span style={{ fontSize: "0.6rem", fontWeight: 600, color: bien.color, background: `${bien.color}14`, padding: "0.18rem 0.5rem", borderRadius: "100px", whiteSpace: "nowrap" }}>
                        {bien.statut}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: C.orange, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {bien.loyer}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.6rem 0.875rem",
                    background: C.orangeBg,
                    borderRadius: "0.625rem",
                    border: `1px solid ${C.orangeBorder}`,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ color: C.orange, fontSize: "0.75rem" }}>✦</span>
                  <span style={{ color: C.textMuted, fontSize: "0.68rem" }}>Demandez quelque chose à Althy...</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
