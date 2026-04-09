"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "althy_cookie_consent";

type ConsentLevel = "all" | "essential" | null;

interface ConsentState {
  level: ConsentLevel;
  at: string;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function save(level: "all" | "essential") {
    const state: ConsentState = { level, at: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
    setVisible(false);

    // Conditionally load analytics
    if (level === "all" && typeof window !== "undefined") {
      // PostHog analytics — only if user accepted
      const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      if (posthogKey && !(window as unknown as Record<string, unknown>).posthog) {
        import("posthog-js").then(({ default: posthog }) => {
          posthog.init(posthogKey, {
            api_host: "https://app.posthog.com",
            capture_pageview: true,
            persistence: "localStorage",
          });
        }).catch(() => {});
      }
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Consentement aux cookies"
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        right: 20,
        zIndex: 9999,
        maxWidth: 560,
        marginLeft: "auto",
        marginRight: "auto",
        backgroundColor: "#FFFFFF",
        border: "1px solid #E8E4DC",
        borderRadius: 16,
        padding: "20px 24px",
        boxShadow: "0 8px 40px rgba(61,56,48,0.15)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>🍪</span>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#3D3830" }}>
            Althy respecte votre vie privée
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: "#7A7469", lineHeight: 1.5 }}>
            Nous utilisons des cookies essentiels (authentification, sécurité) et, avec votre accord, des cookies analytiques pour améliorer l&apos;expérience. Conforme{" "}
            <strong>RGPD</strong> et <strong>LPD suisse</strong>.
          </p>
        </div>
      </div>

      {showDetails && (
        <div style={{ marginBottom: 14, padding: "12px 14px", backgroundColor: "#F5F3EF", borderRadius: 10, fontSize: 12, color: "#5A5248", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 600, color: "#3D3830" }}>Cookies utilisés :</p>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            <li><strong>Essentiels</strong> — session auth (Supabase), sécurité CSRF, préférences UI</li>
            <li><strong>Analytiques</strong> — PostHog (anonymisé, sans données personnelles), Sentry (erreurs)</li>
          </ul>
          <p style={{ margin: "8px 0 0", color: "#7A7469" }}>
            Aucune donnée vendue à des tiers. Droit d&apos;accès / suppression :{" "}
            <a href="mailto:privacy@althy.ch" style={{ color: "#B55A30" }}>privacy@althy.ch</a>
          </p>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => save("all")}
          style={{
            padding: "9px 18px",
            backgroundColor: "#B55A30",
            color: "#fff",
            border: "none",
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Accepter tout
        </button>
        <button
          onClick={() => save("essential")}
          style={{
            padding: "9px 18px",
            backgroundColor: "transparent",
            color: "#5A5248",
            border: "1px solid #E8E4DC",
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Essentiels seulement
        </button>
        <button
          onClick={() => setShowDetails(v => !v)}
          style={{
            padding: "9px 14px",
            backgroundColor: "transparent",
            color: "#B55A30",
            border: "none",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {showDetails ? "Masquer" : "En savoir plus"}
        </button>
      </div>
    </div>
  );
}

/** Returns the stored consent level or null if not yet set. */
export function getConsentLevel(): ConsentLevel {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return (JSON.parse(stored) as ConsentState).level;
  } catch {
    return null;
  }
}
