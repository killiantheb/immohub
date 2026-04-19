import type { Metadata } from "next";
import Link from "next/link";
import { AlthyLogo } from "@/components/AlthyLogo";
import PrintButton from "./_PrintButton";

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

const LEGAL_LINKS = [
  { href: "/legal", label: "Mentions légales" },
  { href: "/legal/cgu", label: "CGU" },
  { href: "/legal/confidentialite", label: "Confidentialité" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/disclaimer-ia", label: "Disclaimer IA" },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--althy-bg)", fontFamily: "var(--font-sans)", color: "var(--althy-text)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--althy-border)", background: "#fff", padding: "0 1.5rem", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
              <AlthyLogo size={28} />
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 400, color: "var(--althy-text)" }}>Althy</span>
            </Link>
            <span style={{ color: "var(--althy-border)" }}>|</span>
            <span style={{ fontSize: 12, color: "var(--althy-text-3)", letterSpacing: "1px", textTransform: "uppercase" as const }}>Informations légales</span>
          </div>
          <PrintButton />
        </div>
      </header>

      {/* Navigation légale */}
      <nav style={{ borderBottom: "1px solid var(--althy-border)", background: "#fff", overflowX: "auto" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 1.5rem", display: "flex", gap: 0 }}>
          {LEGAL_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              style={{ padding: "10px 16px", fontSize: 12, fontWeight: 500, color: "var(--althy-text-3)", textDecoration: "none", whiteSpace: "nowrap" as const, borderBottom: "2px solid transparent", display: "block" }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--althy-border)", background: "#fff", padding: "1.5rem", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "var(--althy-text-3)", marginBottom: "0.75rem" }}>
          &copy; {new Date().getFullYear()} Althy — Tous droits réservés
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          {LEGAL_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ fontSize: 11, color: "var(--althy-text-3)", textDecoration: "none" }}>
              {l.label}
            </Link>
          ))}
        </div>
      </footer>

      {/* Print CSS */}
      <style>{`
        @media print {
          header, nav, footer { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
