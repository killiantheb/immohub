"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AlthyLogo } from "@/components/AlthyLogo";

export default function RejoindreTokenPage() {
  const params    = useParams<{ token: string }>();
  const router    = useRouter();
  const [prenom,  setPrenom]  = useState("");
  const [nom,     setNom]     = useState("");
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [erreur,  setErreur]  = useState<string | null>(null);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!prenom.trim() || !email.trim()) return;
    setLoading(true);
    setErreur(null);
    try {
      const res = await api.post<{ ok: boolean; auth_url?: string; role?: string }>(
        "/onboarding/rejoindre",
        { token: params.token, prenom: prenom.trim(), nom: nom.trim(), email: email.trim().toLowerCase() },
      );
      if (res.data.auth_url) {
        // Supabase magic link — redirect for auto sign-in
        window.location.href = res.data.auth_url;
      } else {
        // Fallback — redirect to bienvenue
        router.push("/bienvenue?auto=true");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (msg?.includes("expiré")) {
        setErreur("Ce lien a expiré. Demandez un nouveau lien à votre agence.");
      } else if (msg?.includes("utilisé")) {
        setErreur("Ce lien a déjà été utilisé. Connectez-vous directement sur althy.ch.");
      } else if (msg?.includes("email")) {
        setErreur("L'email ne correspond pas à l'invitation.");
      } else {
        setErreur("Lien invalide ou expiré. Contactez votre agence.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--althy-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 36, textAlign: "center" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 24 }}>
          <AlthyLogo variant="mark" size={56} />
        </a>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--althy-text)", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Rejoindre Althy
        </h1>
        <p style={{ color: "var(--althy-text-3)", fontSize: 14, margin: 0 }}>
          Votre agence vous invite à utiliser Althy. Confirmez vos informations pour accéder à votre espace.
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "var(--althy-surface)",
        borderRadius: 18,
        border: "1px solid var(--althy-border)",
        padding: "32px",
        boxShadow: "var(--althy-shadow-md)",
      }}>
        <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Prénom */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--althy-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              Prénom *
            </label>
            <input
              type="text"
              value={prenom}
              onChange={e => setPrenom(e.target.value)}
              required
              autoFocus
              placeholder="Marie"
              style={{ width: "100%", padding: "11px 14px", border: "1px solid var(--althy-border)", borderRadius: 10, fontSize: 14, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>

          {/* Nom */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--althy-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              Nom
            </label>
            <input
              type="text"
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Dupont"
              style={{ width: "100%", padding: "11px 14px", border: "1px solid var(--althy-border)", borderRadius: 10, fontSize: 14, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>

          {/* Email */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--althy-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="marie@agence.ch"
              style={{ width: "100%", padding: "11px 14px", border: "1px solid var(--althy-border)", borderRadius: 10, fontSize: 14, background: "var(--althy-bg)", color: "var(--althy-text)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </div>

          {/* Error */}
          {erreur && (
            <div style={{ padding: "10px 14px", background: "var(--althy-red-bg)", borderRadius: 10, border: "1px solid var(--althy-red)" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--althy-red)" }}>{erreur}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !prenom.trim() || !email.trim()}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 11,
              background: "var(--althy-orange)",
              color: "#fff",
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              cursor: loading || !prenom.trim() || !email.trim() ? "not-allowed" : "pointer",
              opacity: loading || !prenom.trim() || !email.trim() ? 0.7 : 1,
              fontFamily: "inherit",
              marginTop: 4,
              transition: "opacity 0.18s",
            }}
          >
            {loading ? "Connexion en cours…" : "Accéder à mon espace →"}
          </button>
        </form>

        <p style={{ fontSize: 12, color: "var(--althy-text-3)", textAlign: "center", margin: "20px 0 0" }}>
          Vous avez déjà un compte ?{" "}
          <a href="/login" style={{ color: "var(--althy-orange)", textDecoration: "none", fontWeight: 600 }}>
            Se connecter
          </a>
        </p>
      </div>

      {/* Trust line */}
      <p style={{ color: "var(--althy-text-3)", fontSize: 11, marginTop: 28, textAlign: "center" }}>
        Althy · L'assistant immobilier suisse · <a href="https://althy.ch" style={{ color: "var(--althy-text-3)" }}>althy.ch</a>
      </p>
    </div>
  );
}
