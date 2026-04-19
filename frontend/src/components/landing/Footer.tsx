"use client"

import Link from "next/link"
import { C } from "@/lib/design-tokens"

export function Footer() {
  return (
    <footer
      style={{
        background: C.bg,
        borderTop: `1px solid ${C.border}`,
        padding: "3rem 1.5rem 2.5rem",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* Top row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "2rem",
            marginBottom: "2.5rem",
          }}
        >
          {/* Logo + tagline */}
          <div>
            <Link href="/" style={{ textDecoration: "none" }}>
              <span
                style={{
                  fontFamily: "var(--font-serif)",
                  color: C.orange,
                  fontSize: "1.625rem",
                  fontWeight: 500,
                  letterSpacing: "0.16em",
                  display: "block",
                  marginBottom: "0.5rem",
                }}
              >
                Althy
              </span>
            </Link>
            <p style={{ color: C.textMuted, fontSize: "0.8125rem", margin: 0, lineHeight: 1.6 }}>
              L&apos;assistant immobilier suisse
              <br />
              <span style={{ fontSize: "0.75rem", letterSpacing: "0.04em" }}>
                Genève · Lausanne · Vaud · Valais
              </span>
            </p>
          </div>

          {/* Links */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem 2.5rem",
              alignItems: "center",
            }}
          >
            {[
              { label: "Mentions légales", href: "/legal" },
              { label: "Confidentialité", href: "/legal/confidentialite" },
              { label: "CGU", href: "/legal/cgu" },
              { label: "Cookies", href: "/legal/cookies" },
              { label: "Contact", href: "/contact" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: C.textMuted,
                  textDecoration: "none",
                  fontSize: "0.8125rem",
                  transition: "color 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.textMuted)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Email */}
          <div>
            <a
              href="mailto:contact@althy.ch"
              style={{
                color: C.orange,
                textDecoration: "none",
                fontSize: "0.875rem",
                transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.75")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              contact@althy.ch
            </a>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: C.border, marginBottom: "1.5rem" }} />

        {/* Bottom */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <p style={{ color: C.textMuted, fontSize: "0.75rem", margin: 0 }}>
            © {new Date().getFullYear()} Althy — Killian Thébaud · Tous droits réservés
          </p>
          <p style={{ color: C.textMuted, fontSize: "0.75rem", margin: 0 }}>
            Fabriqué en Suisse Romande ·{" "}
            <a href="https://althy.ch" style={{ color: C.textMuted, textDecoration: "none" }}>
              althy.ch
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
