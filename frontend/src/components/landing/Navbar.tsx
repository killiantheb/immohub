"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { AlthySphere } from "@/components/AlthySphere"

const C = {
  bg: "rgba(250,248,244,0.92)",
  bgSolid: "#FAF8F4",
  border: "rgba(40,18,8,0.08)",
  text: "#1A1208",
  textMid: "rgba(26,18,8,0.58)",
  orange: "var(--althy-orange)",
  orangeBorder: "rgba(232,96,44,0.22)",
} as const

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        boxShadow: scrolled ? "0 4px 24px rgba(40,18,8,0.07)" : "none",
        transition: "box-shadow 0.3s ease",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 1.5rem",
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo — Sphère + Althy */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <AlthySphere size={30} />
          <span
            style={{
              fontFamily: "var(--font-serif), 'Cormorant Garamond', serif",
              color: C.orange,
              fontSize: "1.65rem",
              fontWeight: 500,
              letterSpacing: "0.16em",
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            Althy
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex" style={{ gap: "2.5rem", alignItems: "center" }}>
          {[
            { label: "Comment ça marche", href: "#features" },
            { label: "Pour qui", href: "#pour-qui" },
            { label: "Tarifs", href: "#tarifs" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                color: C.textMid,
                textDecoration: "none",
                fontSize: "0.875rem",
                letterSpacing: "0.01em",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textMid)}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex" style={{ gap: "0.75rem", alignItems: "center" }}>
          <Link
            href="/app"
            style={{
              color: C.textMid,
              textDecoration: "none",
              fontSize: "0.875rem",
              padding: "0.5rem 1.25rem",
              border: `1px solid ${C.border}`,
              borderRadius: "100px",
              transition: "border-color 0.2s, color 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.orangeBorder; e.currentTarget.style.color = C.orange }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMid }}
          >
            Se connecter
          </Link>
          <Link
            href="/app"
            style={{
              background: C.orange,
              color: "#FFFFFF",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              padding: "0.5rem 1.4rem",
              borderRadius: "100px",
              transition: "opacity 0.2s, transform 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.87"; e.currentTarget.style.transform = "translateY(-1px)" }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)" }}
          >
            Essayer gratuitement
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "0.5rem", color: C.text }}
          aria-label="Menu"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            {menuOpen ? (
              <>
                <line x1="4" y1="4" x2="18" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="18" y1="4" x2="4" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            ) : (
              <>
                <line x1="3" y1="7" x2="19" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="3" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="3" y1="17" x2="19" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          style={{
            background: "#FAF8F4",
            borderTop: `1px solid ${C.border}`,
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {[
            { label: "Comment ça marche", href: "#features" },
            { label: "Pour qui", href: "#pour-qui" },
            { label: "Tarifs", href: "#tarifs" },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              style={{
                color: C.textMid,
                textDecoration: "none",
                fontSize: "1rem",
                paddingBottom: "0.75rem",
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              {item.label}
            </a>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "0.5rem" }}>
            <Link href="/app" onClick={() => setMenuOpen(false)} style={{ color: C.text, textDecoration: "none", fontSize: "0.9375rem", padding: "0.75rem 1.5rem", border: `1px solid ${C.border}`, borderRadius: "100px", textAlign: "center" }}>
              Se connecter
            </Link>
            <Link href="/app" onClick={() => setMenuOpen(false)} style={{ background: C.orange, color: "#FFFFFF", textDecoration: "none", fontSize: "0.9375rem", fontWeight: 600, padding: "0.75rem 1.5rem", borderRadius: "100px", textAlign: "center" }}>
              Essayer gratuitement
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
