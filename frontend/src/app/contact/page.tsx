"use client";

import { useState } from "react";
import Link from "next/link";
import type { Metadata } from "next";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// ── Formulaire de contact ─────────────────────────────────────────────────────

export default function ContactPage() {
  const [form, setForm] = useState({ nom: "", email: "", sujet: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom || !form.email || !form.message) return;
    setStatus("sending");

    try {
      const res = await fetch(`${API}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "ok" : "err");
    } catch {
      setStatus("err");
    }
  }

  const INPUT: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    border: "1px solid var(--althy-border)",
    borderRadius: "var(--radius-elem)",
    fontSize: 14,
    color: "var(--althy-text)",
    background: "var(--althy-surface)",
    outline: "none",
    boxSizing: "border-box",
  };

  const LABEL: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--althy-text-3)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 6,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--althy-bg)", fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <header style={{
        background: "var(--althy-surface)",
        borderBottom: "1px solid var(--althy-border)",
        padding: "0 24px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <Link href="/" style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 300, color: "var(--althy-text)", letterSpacing: "-0.02em" }}>
          ALTHY
        </Link>
        <Link href="/" style={{ fontSize: 13, color: "var(--althy-text-3)" }}>← Retour à althy.ch</Link>
      </header>

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Titre */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem,5vw,2.8rem)", fontWeight: 300, color: "var(--althy-text)", margin: "0 0 12px" }}>
            Contactez-nous
          </h1>
          <p style={{ color: "var(--althy-text-2)", fontSize: 15, lineHeight: 1.7, margin: 0 }}>
            Une question, un partenariat ou un problème ? Notre équipe répond en moins de 24 heures ouvrées.
          </p>
        </div>

        {/* Liens rapides */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 36 }}>
          {[
            { label: "Support", href: "mailto:support@althy.ch" },
            { label: "Partenariats", href: "mailto:partnerships@althy.ch" },
            { label: "Données personnelles", href: "mailto:privacy@althy.ch" },
          ].map(item => (
            <a key={item.label} href={item.href} style={{
              fontSize: 13,
              color: "var(--althy-orange)",
              border: "1px solid var(--althy-orange-border)",
              padding: "6px 14px",
              borderRadius: 20,
              textDecoration: "none",
            }}>
              {item.label}
            </a>
          ))}
        </div>

        {/* Formulaire */}
        {status === "ok" ? (
          <div style={{
            background: "var(--althy-green-bg)",
            border: "1px solid var(--althy-green)",
            borderRadius: "var(--radius-card)",
            padding: "28px 24px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 20, marginBottom: 8 }}>✓</p>
            <p style={{ color: "var(--althy-text)", fontWeight: 600, margin: "0 0 6px" }}>Message envoyé !</p>
            <p style={{ color: "var(--althy-text-2)", fontSize: 14, margin: 0 }}>
              Nous vous répondrons sous 24h ouvrées à <strong>{form.email}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            background: "var(--althy-surface)",
            border: "1px solid var(--althy-border)",
            borderRadius: "var(--radius-card)",
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={LABEL}>Nom *</label>
                <input
                  style={INPUT}
                  type="text"
                  placeholder="Jean Dupont"
                  value={form.nom}
                  onChange={e => set("nom", e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={LABEL}>Email *</label>
                <input
                  style={INPUT}
                  type="email"
                  placeholder="jean@example.com"
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label style={LABEL}>Sujet</label>
              <select
                style={INPUT}
                value={form.sujet}
                onChange={e => set("sujet", e.target.value)}
              >
                <option value="">Sélectionner…</option>
                <option value="support">Support technique</option>
                <option value="partenariat">Partenariat / agence</option>
                <option value="facturation">Facturation / abonnement</option>
                <option value="rgpd">Données personnelles (RGPD)</option>
                <option value="presse">Presse / médias</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            <div>
              <label style={LABEL}>Message *</label>
              <textarea
                style={{ ...INPUT, minHeight: 140, resize: "vertical" }}
                placeholder="Décrivez votre demande…"
                value={form.message}
                onChange={e => set("message", e.target.value)}
                required
              />
            </div>

            {status === "err" && (
              <p style={{ color: "var(--althy-red)", fontSize: 13, margin: 0 }}>
                Une erreur s&apos;est produite. Réessayez ou écrivez directement à support@althy.ch.
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                background: status === "sending" ? "var(--althy-text-3)" : "var(--althy-orange)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-elem)",
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: status === "sending" ? "not-allowed" : "pointer",
                alignSelf: "flex-start",
              }}
            >
              {status === "sending" ? "Envoi en cours…" : "Envoyer le message"}
            </button>
          </form>
        )}

        {/* Infos */}
        <p style={{ marginTop: 32, fontSize: 13, color: "var(--althy-text-3)", textAlign: "center" }}>
          Althy · Suisse · Réponse sous 24h ouvrées · <a href="mailto:support@althy.ch" style={{ color: "var(--althy-orange)" }}>support@althy.ch</a>
        </p>
      </main>
    </div>
  );
}
