"use client"

import { motion } from "framer-motion"
import Link from "next/link"

const C = {
  bg: "#0A0A0A",
  surface: "#111111",
  surface2: "#161616",
  border: "rgba(255,255,255,0.08)",
  text: "#FFFFFF",
  textMid: "rgba(255,255,255,0.65)",
  textMuted: "rgba(255,255,255,0.38)",
  gold: "#C9A96E",
  goldBg: "rgba(201,169,110,0.10)",
  goldBorder: "rgba(201,169,110,0.25)",
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
  { adresse: "Rue de Rive 12, Genève", statut: "Loué", loyer: "CHF 2 400", badge: "#22c55e" },
  { adresse: "Av. de la Gare 8, Lausanne", statut: "Loué", loyer: "CHF 1 850", badge: "#22c55e" },
  { adresse: "Chemin des Fleurs 4, Nyon", statut: "Vacant", loyer: "CHF 1 600", badge: "#f59e0b" },
  { adresse: "Grand-Rue 21, Sion", statut: "Loué", loyer: "CHF 1 200", badge: "#22c55e" },
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
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "500px",
          background: "radial-gradient(ellipse, rgba(201,169,110,0.06) 0%, transparent 70%)",
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
        {/* Left: text content */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          {/* Eyebrow */}
          <motion.div variants={fadeUp}>
            <span
              style={{
                color: C.gold,
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: C.goldBg,
                border: `1px solid ${C.goldBorder}`,
                padding: "0.35rem 0.9rem",
                borderRadius: "100px",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, display: "inline-block" }} />
              Assistant immobilier suisse
            </span>
          </motion.div>

          {/* H1 */}
          <motion.div variants={fadeUp}>
            <h1
              style={{
                fontFamily: "var(--font-inter, Inter, sans-serif)",
                fontSize: "clamp(3.5rem, 7vw, 5.5rem)",
                fontWeight: 700,
                lineHeight: 1.05,
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              <span style={{ color: C.text, display: "block" }}>Gérez vos biens.</span>
              <span style={{ color: C.gold, display: "block" }}>Althy fait le reste.</span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            style={{
              color: C.textMid,
              fontSize: "1.125rem",
              maxWidth: 480,
              lineHeight: 1.65,
              margin: 0,
            }}
          >
            L&apos;assistant immobilier suisse — loyers, locataires, ouvreurs, artisans. Tout automatisé, tout centralisé, 24h/24.
          </motion.p>

          {/* Stats */}
          <motion.div
            variants={fadeUp}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem 1rem",
              color: C.gold,
              fontSize: "0.9rem",
              fontWeight: 500,
            }}
          >
            {["180 biens actifs", "100+ visites/mois", "CHF 29 / mois"].map((stat, i) => (
              <span key={stat} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {i > 0 && <span style={{ color: C.gold, opacity: 0.4 }}>·</span>}
                {stat}
              </span>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}
          >
            <Link
              href="/app"
              style={{
                background: C.gold,
                color: "#000000",
                textDecoration: "none",
                fontSize: "1rem",
                fontWeight: 600,
                padding: "0.875rem 2rem",
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
            <a
              href="#features"
              style={{
                color: C.gold,
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
              boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
            }}
          >
            {/* Mock header */}
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: C.surface2,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontFamily: "var(--font-serif)", color: C.gold, fontSize: "1rem", letterSpacing: "0.15em" }}>
                  Althy
                </span>
                <span style={{ color: C.textMuted, fontSize: "0.75rem" }}>Dashboard</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                  <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
                ))}
              </div>
            </div>

            {/* Mock sidebar + content */}
            <div style={{ display: "flex" }}>
              {/* Sidebar */}
              <div
                style={{
                  width: 56,
                  background: C.surface2,
                  borderRight: `1px solid ${C.border}`,
                  padding: "1rem 0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1.25rem",
                }}
              >
                {["🏠", "👤", "🔧", "📄", "💬"].map((icon) => (
                  <span key={icon} style={{ fontSize: "1rem", opacity: 0.5 }}>
                    {icon}
                  </span>
                ))}
              </div>

              {/* Main content */}
              <div style={{ flex: 1, padding: "1.25rem" }}>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: C.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: "0.75rem",
                  }}
                >
                  Mes biens — Avril 2026
                </div>

                {/* Table header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto",
                    gap: "0.5rem",
                    padding: "0.5rem 0.75rem",
                    marginBottom: "0.25rem",
                    fontSize: "0.65rem",
                    color: C.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  <span>Adresse</span>
                  <span>Statut</span>
                  <span>Loyer</span>
                </div>

                {/* Table rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {BIENS.map((bien) => (
                    <div
                      key={bien.adresse}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        gap: "0.75rem",
                        alignItems: "center",
                        padding: "0.625rem 0.75rem",
                        background: "rgba(255,255,255,0.025)",
                        borderRadius: "0.5rem",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <span style={{ fontSize: "0.7rem", color: C.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {bien.adresse}
                      </span>
                      <span
                        style={{
                          fontSize: "0.6rem",
                          fontWeight: 600,
                          color: bien.badge,
                          background: `${bien.badge}18`,
                          padding: "0.2rem 0.5rem",
                          borderRadius: "100px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {bien.statut}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: C.gold, fontWeight: 600, whiteSpace: "nowrap" }}>
                        {bien.loyer}
                      </span>
                    </div>
                  ))}
                </div>

                {/* AI input */}
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.625rem 0.875rem",
                    background: C.surface2,
                    borderRadius: "0.625rem",
                    border: `1px solid ${C.goldBorder}`,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ color: C.gold, fontSize: "0.75rem" }}>✦</span>
                  <span style={{ color: C.textMuted, fontSize: "0.7rem" }}>Demandez quelque chose à Althy...</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
