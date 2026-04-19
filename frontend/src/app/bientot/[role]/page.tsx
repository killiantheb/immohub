"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlthyLogo } from "@/components/AlthyLogo";
import { CheckCircle2, ArrowLeft } from "lucide-react";

const ROLE_INFO: Record<string, { label: string; icon: string; description: string }> = {
  agence:           { label: "Agence immobilière",   icon: "🏢", description: "Gérez vos agents, portefeuille et portail propriétaire depuis un seul espace." },
  artisan:          { label: "Artisan / Professionnel", icon: "🔧", description: "Recevez des missions, envoyez des devis et gérez vos chantiers directement depuis Althy." },
  opener:           { label: "Ouvreur",              icon: "🚪", description: "Organisez des visites, recevez des missions et gérez vos revenus." },
  expert:           { label: "Expert immobilier",    icon: "📊", description: "Proposez vos services d'expertise et connectez-vous aux propriétaires et agences." },
  hunter:           { label: "Hunter",               icon: "🎯", description: "Identifiez des opportunités immobilières et touchez une commission sur chaque transaction." },
  acheteur_premium: { label: "Acheteur Premium",     icon: "🏠", description: "Accédez aux biens off-market, alertes instantanées et matching IA." },
  portail_proprio:  { label: "Portail Proprio",      icon: "📋", description: "Suivez vos biens gérés par votre agence en temps réel." },
};

const FALLBACK = { label: "Ce rôle", icon: "🚀", description: "Cette fonctionnalité sera bientôt disponible sur Althy." };

export default function BientotPage() {
  const { role } = useParams<{ role: string }>();
  const info = ROLE_INFO[role] ?? FALLBACK;
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: POST to /api/v1/waitlist or store in Supabase
    setSubmitted(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--althy-bg, #FAFAF8)" }}>
      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 24px", borderBottom: "1px solid var(--althy-border, #E8E4DC)",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}>
          <AlthyLogo size={28} />
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--althy-text, #3D3830)" }}>ALTHY</span>
        </Link>
        <Link
          href="/register"
          style={{
            fontSize: 14, color: "var(--althy-orange)", fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Créer un compte →
        </Link>
      </header>

      {/* Content */}
      <main style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "calc(100vh - 65px)", padding: "32px 16px",
      }}>
        <div style={{
          maxWidth: 520, width: "100%", textAlign: "center",
          background: "var(--althy-surface, #fff)",
          border: "1px solid var(--althy-border, #E8E4DC)",
          borderRadius: "var(--radius-card, 12px)",
          padding: "48px 32px",
        }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>{info.icon}</div>

          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28, fontWeight: 600, marginBottom: 8,
            color: "var(--althy-text, #3D3830)",
          }}>
            {info.label}
          </h1>
          <p style={{
            fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1,
            color: "var(--althy-orange)", marginBottom: 16,
          }}>
            Bientôt disponible
          </p>
          <p style={{
            color: "var(--althy-text-2, #5C5650)",
            fontSize: 15, lineHeight: 1.6, marginBottom: 32,
          }}>
            {info.description}
          </p>

          {/* Waitlist form */}
          {!submitted ? (
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, maxWidth: 400, margin: "0 auto" }}>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="votre@email.com"
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: "var(--radius-elem, 8px)",
                  border: "1px solid var(--althy-border, #E8E4DC)",
                  fontSize: 14, outline: "none",
                }}
              />
              <button
                type="submit"
                style={{
                  padding: "10px 20px", borderRadius: "var(--radius-elem, 8px)",
                  background: "var(--althy-orange)", color: "#fff",
                  fontWeight: 600, fontSize: 14, border: "none", cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Me prévenir
              </button>
            </form>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 20px", borderRadius: "var(--radius-elem, 8px)",
              background: "rgba(34,197,94,0.08)", color: "#16a34a",
              fontWeight: 600, fontSize: 14,
            }}>
              <CheckCircle2 size={18} />
              Inscrit ! Nous vous préviendrons dès le lancement.
            </div>
          )}

          {/* Back link */}
          <div style={{ marginTop: 32 }}>
            <Link
              href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 14, color: "var(--althy-text-3, #7A7469)",
                textDecoration: "none",
              }}
            >
              <ArrowLeft size={14} />
              Retour à althy.ch
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
