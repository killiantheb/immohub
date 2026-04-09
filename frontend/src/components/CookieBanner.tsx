"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "althy_cookie_consent";
const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;

interface ConsentRecord {
  analytics: boolean;
  marketing: boolean; // always false — no ads in app
  savedAt: string;
  expires: string;
}

type Mode = "banner" | "customize";

function loadConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as ConsentRecord;
    if (new Date(rec.expires) < new Date()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

function activatePostHog() {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!posthogKey || typeof window === "undefined") return;
  if ((window as unknown as Record<string, unknown>).posthog) return;
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(posthogKey, {
      api_host: "https://app.posthog.com",
      capture_pageview: true,
      persistence: "localStorage",
    });
  }).catch(() => {});
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<Mode>("banner");
  const [analyticsChecked, setAnalyticsChecked] = useState(false);

  useEffect(() => {
    const rec = loadConsent();
    if (!rec) {
      setVisible(true);
    } else if (rec.analytics) {
      activatePostHog();
    }
  }, []);

  function saveConsent(analytics: boolean) {
    const now = new Date();
    const rec: ConsentRecord = {
      analytics,
      marketing: false,
      savedAt: now.toISOString(),
      expires: new Date(now.getTime() + SIX_MONTHS_MS).toISOString(),
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rec)); } catch {}
    if (analytics) activatePostHog();
    setVisible(false);
  }

  if (!visible) return null;

  if (mode === "customize") {
    return (
      <div
        role="dialog"
        aria-label="Personnaliser les cookies"
        style={{
          position: "fixed", bottom: 20, left: 20, right: 20, zIndex: 9999,
          maxWidth: 520, marginLeft: "auto", marginRight: "auto",
          backgroundColor: "#FFFFFF", border: "2px solid #B55A30",
          borderRadius: 16, padding: "20px 24px",
          boxShadow: "0 8px 40px rgba(61,56,48,0.18)",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#3D3830" }}>
          Personnaliser les cookies
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#7A7469", lineHeight: 1.5 }}>
          Choisissez les catégories de cookies que vous acceptez.{" "}
          <Link href="/legal/cookies" style={{ color: "#B55A30" }}>Politique cookies</Link>
        </p>

        {/* Essential — always on */}
        <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #E8E4DC", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#3D3830" }}>Essentiels</p>
            <p style={{ margin: 0, fontSize: 11, color: "#7A7469" }}>Session auth, sécurité CSRF — toujours actifs</p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#5A7D54", background: "#EBF2EA", padding: "3px 8px", borderRadius: 6 }}>Toujours actif</span>
        </div>

        {/* Analytics — toggleable */}
        <div style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${analyticsChecked ? "#B55A30" : "#E8E4DC"}`, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#3D3830" }}>Analytiques</p>
            <p style={{ margin: 0, fontSize: 11, color: "#7A7469" }}>PostHog (anonymisé), Sentry erreurs, Vercel Web Vitals</p>
          </div>
          <button
            onClick={() => setAnalyticsChecked(v => !v)}
            aria-pressed={analyticsChecked}
            style={{
              width: 44, height: 24, borderRadius: 12,
              background: analyticsChecked ? "#B55A30" : "#D1CBC4",
              border: "none", cursor: "pointer", position: "relative", flexShrink: 0,
              transition: "background 0.2s",
            }}
          >
            <span style={{
              position: "absolute", top: 3, left: analyticsChecked ? 23 : 3,
              width: 18, height: 18, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s",
            }} />
          </button>
        </div>

        {/* Marketing — always N/A */}
        <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #E8E4DC", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.6 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#3D3830" }}>Marketing</p>
            <p style={{ margin: 0, fontSize: 11, color: "#7A7469" }}>Publicité, remarketing — Althy n&apos;utilise aucun cookie publicitaire</p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#7A7469", background: "#F5F2EE", padding: "3px 8px", borderRadius: 6 }}>N/A</span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => saveConsent(analyticsChecked)}
            style={{
              padding: "9px 18px", backgroundColor: "#B55A30", color: "#fff",
              border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Enregistrer mes choix
          </button>
          <button
            onClick={() => setMode("banner")}
            style={{
              padding: "9px 14px", backgroundColor: "transparent", color: "#7A7469",
              border: "1px solid #E8E4DC", borderRadius: 9, fontSize: 13, cursor: "pointer",
            }}
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Gestion des cookies"
      style={{
        position: "fixed", bottom: 20, left: 20, right: 20, zIndex: 9999,
        maxWidth: 560, marginLeft: "auto", marginRight: "auto",
        backgroundColor: "#FFFFFF", border: "1px solid #E8E4DC",
        borderRadius: 16, padding: "18px 22px",
        boxShadow: "0 8px 40px rgba(61,56,48,0.15)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#3D3830" }}>
        Althy respecte votre vie privée
      </p>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#7A7469", lineHeight: 1.55 }}>
        Cookies essentiels toujours actifs. Cookies analytiques avec votre accord.{" "}
        <Link href="/legal/cookies" style={{ color: "#B55A30" }}>Politique cookies</Link>
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => saveConsent(true)}
          style={{
            padding: "9px 18px", backgroundColor: "#B55A30", color: "#fff",
            border: "none", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
        >
          Accepter tout
        </button>
        <button
          onClick={() => saveConsent(false)}
          style={{
            padding: "9px 16px", backgroundColor: "transparent", color: "#5A5248",
            border: "1px solid #E8E4DC", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          Refuser
        </button>
        <button
          onClick={() => setMode("customize")}
          style={{
            padding: "9px 14px", backgroundColor: "transparent", color: "#B55A30",
            border: "none", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline",
          }}
        >
          Personnaliser
        </button>
      </div>
    </div>
  );
}

/** Returns stored consent or null if not yet set / expired. */
export function getConsentRecord(): ConsentRecord | null {
  return loadConsent();
}

/** Returns true if analytics cookies were accepted. */
export function hasAnalyticsConsent(): boolean {
  return loadConsent()?.analytics ?? false;
}
