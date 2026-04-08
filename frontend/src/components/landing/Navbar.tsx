"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

const C = {
  bg: "#0A0A0A",
  gold: "#C9A96E",
  text: "#FFFFFF",
  textMid: "rgba(255,255,255,0.65)",
  border: "rgba(255,255,255,0.06)",
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
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        background: "rgba(0,0,0,0.80)",
        borderBottom: `1px solid ${C.border}`,
        boxShadow: scrolled ? "0 4px 40px rgba(0,0,0,0.5)" : "none",
        transition: "box-shadow 0.3s ease",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 1.5rem",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <span
            style={{
              fontFamily: "var(--font-serif)",
              color: C.gold,
              fontSize: "1.5rem",
              fontWeight: 300,
              letterSpacing: "0.25em",
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
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.textMid)}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA buttons */}
        <div className="hidden md:flex" style={{ gap: "0.75rem", alignItems: "center" }}>
          <Link
            href="/app"
            style={{
              color: C.text,
              textDecoration: "none",
              fontSize: "0.875rem",
              padding: "0.5rem 1.25rem",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "100px",
              transition: "border-color 0.2s, color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"
            }}
          >
            Se connecter
          </Link>
          <Link
            href="/app"
            style={{
              background: C.gold,
              color: "#000000",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              padding: "0.5rem 1.25rem",
              borderRadius: "100px",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Essayer gratuitement
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.5rem",
            color: C.text,
          }}
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
            background: "rgba(10,10,10,0.98)",
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
            <Link
              href="/app"
              onClick={() => setMenuOpen(false)}
              style={{
                color: C.text,
                textDecoration: "none",
                fontSize: "0.9375rem",
                padding: "0.75rem 1.5rem",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "100px",
                textAlign: "center",
              }}
            >
              Se connecter
            </Link>
            <Link
              href="/app"
              onClick={() => setMenuOpen(false)}
              style={{
                background: C.gold,
                color: "#000000",
                textDecoration: "none",
                fontSize: "0.9375rem",
                fontWeight: 600,
                padding: "0.75rem 1.5rem",
                borderRadius: "100px",
                textAlign: "center",
              }}
            >
              Essayer gratuitement
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
