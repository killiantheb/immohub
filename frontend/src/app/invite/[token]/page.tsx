"use client";

/**
 * Page publique d'acceptation invitation locataire — Sprint 1C.
 * Phase 1.0 doctrine v6 §4.7.
 *
 * Workflow :
 *   1. GET /api/v1/invite/{token}/preview (public, Sprint 1C backend c1)
 *      → pré-remplit prenom/nom/email + affiche bailleur_nom + bien_adresse
 *   2. Si statut === "used" → message "Lien déjà utilisé, connectez-vous"
 *      Si statut === "expired" → message "Lien expiré, demandez un nouveau"
 *      Si statut === "pending" → form de création de compte
 *   3. Submit → POST /api/v1/onboarding/rejoindre {token, prenom, nom, email}
 *      (Sprint 1B : branche target_role=locataire crée user Supabase + Locataire
 *      + retourne auth_url Supabase magic link signin)
 *   4. Redirect window.location vers auth_url → Supabase signin auto
 *      → redirect /app/mon-bien (cohérent avec layout Sprint 1A)
 *
 * Branding : doctrine v6 §B.4 — bleu Prusse + or, fonts Fraunces/DM Sans.
 * Pas d'auth nécessaire (route hors PROTECTED_PREFIXES middleware).
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import axios from "axios";
import { AlthyLogo } from "@/components/AlthyLogo";
import { C } from "@/lib/design-tokens";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.althy.ch/api/v1")
  .trim()
  .replace(/\/$/, "")
  .replace(/^http:\/\//, "https://");

// Public axios — pas d'auth header (la page est accessible avant signup)
const pub = axios.create({ baseURL: API_BASE });

interface PreviewResponse {
  invitation_id: string;
  target_email: string;
  prenom: string | null;
  nom: string | null;
  message_personnel: string | null;
  bailleur_nom: string | null;
  bien_adresse_courte: string | null;
  expires_at: string;
  statut: "pending" | "used" | "expired";
}

interface RejoindreResponse {
  ok: boolean;
  user_id: string;
  role: string;
  bien_id: string;
  auth_url: string | null;
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Load preview ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    setPreviewLoading(true);
    pub
      .get<PreviewResponse>(`/invite/${token}/preview`)
      .then((r) => {
        setPreview(r.data);
        setPrenom(r.data.prenom ?? "");
        setNom(r.data.nom ?? "");
      })
      .catch((err) => {
        const detail = (err as { response?: { status?: number; data?: { detail?: string } } })?.response;
        if (detail?.status === 404) {
          setPreviewError("Cette invitation n'existe pas ou a été révoquée.");
        } else {
          setPreviewError("Impossible de charger l'invitation. Vérifiez votre connexion.");
        }
      })
      .finally(() => setPreviewLoading(false));
  }, [token]);

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || !prenom.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await pub.post<RejoindreResponse>("/onboarding/rejoindre", {
        token,
        prenom: prenom.trim(),
        nom: nom.trim(),
        email: preview.target_email,
      });
      if (res.data.auth_url) {
        // Supabase magic link → signin auto + redirect /app/mon-bien (cf backend Sprint 1B c3)
        window.location.href = res.data.auth_url;
      } else {
        // Fallback : compte créé mais magic link signin non généré → page login
        window.location.href = "/login?invited=true";
      }
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string }; status?: number } })?.response;
      const msg = detail?.data?.detail;
      if (detail?.status === 409) {
        setSubmitError("Cet email est déjà inscrit. Connectez-vous via /login.");
      } else if (detail?.status === 410) {
        setSubmitError("Ce lien a expiré. Demandez un nouveau lien à votre bailleur.");
      } else if (detail?.status === 404) {
        setSubmitError("Ce lien est invalide.");
      } else {
        setSubmitError(msg || "Erreur lors de la création du compte. Réessayez.");
      }
      setSubmitting(false);
    }
  }

  const expiresFormatted = preview
    ? new Date(preview.expires_at).toLocaleDateString("fr-CH", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F1E8",
        fontFamily: "var(--font-sans, Helvetica, Arial, sans-serif)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header style={{ padding: "32px 24px 16px", textAlign: "center" }}>
        <a href="/" style={{ display: "inline-block", textDecoration: "none" }}>
          <AlthyLogo variant="mark" size={48} />
        </a>
      </header>

      {/* Card centrale */}
      <main style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "0 16px 40px" }}>
        <div
          style={{
            width: "100%",
            maxWidth: 460,
            background: "#FFFFFF",
            borderRadius: 16,
            boxShadow: "0 4px 24px rgba(15,46,76,0.10)",
            overflow: "hidden",
          }}
        >
          {/* Header band bleu */}
          <div style={{ background: C.prussian, padding: "24px 32px", textAlign: "center", position: "relative" }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: C.gold,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                margin: "0 0 6px",
              }}
            >
              Invitation
            </p>
            <h1
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: 24,
                fontWeight: 300,
                color: "#FFFFFF",
                margin: 0,
                letterSpacing: "0.01em",
              }}
            >
              Votre espace locataire Althy
            </h1>
            <div
              style={{
                position: "absolute",
                bottom: -1,
                left: "50%",
                transform: "translateX(-50%)",
                height: 2,
                width: 48,
                background: C.gold,
              }}
            />
          </div>

          {/* Body */}
          <div style={{ padding: "32px" }}>
            {previewLoading && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Loader2 size={28} style={{ color: C.prussian, animation: "spin 1s linear infinite" }} />
                <p style={{ fontSize: 13, color: C.text3, marginTop: 12 }}>Chargement de l&apos;invitation…</p>
              </div>
            )}

            {previewError && (
              <StateMessage
                icon={AlertCircle}
                iconColor={C.red}
                title="Lien invalide"
                description={previewError}
                ctaHref="/"
                ctaLabel="Retour à l'accueil"
              />
            )}

            {!previewLoading && preview?.statut === "used" && (
              <StateMessage
                icon={CheckCircle2}
                iconColor={C.green}
                title="Compte déjà créé"
                description="Vous avez déjà accepté cette invitation. Connectez-vous pour accéder à votre espace."
                ctaHref="/login"
                ctaLabel="Se connecter"
              />
            )}

            {!previewLoading && preview?.statut === "expired" && (
              <StateMessage
                icon={AlertCircle}
                iconColor={C.amber}
                title="Lien expiré"
                description="Ce lien d'invitation a expiré. Contactez votre bailleur pour qu'il vous envoie un nouveau lien."
                ctaHref="/"
                ctaLabel="Retour à l'accueil"
              />
            )}

            {!previewLoading && preview?.statut === "pending" && (
              <>
                <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, margin: "0 0 6px" }}>
                  {preview.bailleur_nom ? <strong style={{ color: C.text }}>{preview.bailleur_nom}</strong> : "Votre bailleur"}{" "}
                  vous invite à créer votre espace locataire pour gérer votre logement
                  {preview.bien_adresse_courte && (
                    <>
                      {" "}à <strong style={{ color: C.text }}>{preview.bien_adresse_courte}</strong>
                    </>
                  )}
                  .
                </p>

                {preview.message_personnel && (
                  <div
                    style={{
                      background: "#F5F1E8",
                      borderLeft: `3px solid ${C.gold}`,
                      padding: "12px 16px",
                      margin: "16px 0",
                      fontStyle: "italic",
                      fontSize: 13,
                      color: C.text,
                      borderRadius: "0 8px 8px 0",
                    }}
                  >
                    « {preview.message_personnel} »
                  </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
                  <div>
                    <FormLabel>Email</FormLabel>
                    <FormInput type="email" value={preview.target_email} readOnly disabled />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <FormLabel>Prénom *</FormLabel>
                      <FormInput
                        type="text"
                        required
                        autoFocus={!preview.prenom}
                        value={prenom}
                        onChange={(e) => setPrenom(e.target.value)}
                        placeholder="Marie"
                      />
                    </div>
                    <div>
                      <FormLabel>Nom</FormLabel>
                      <FormInput
                        type="text"
                        value={nom}
                        onChange={(e) => setNom(e.target.value)}
                        placeholder="Dupont"
                      />
                    </div>
                  </div>

                  {submitError && (
                    <p style={{ fontSize: 12, color: C.red, margin: 0, padding: "8px 12px", background: C.redBg, borderRadius: 8 }}>
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !prenom.trim()}
                    style={{
                      padding: "14px 28px",
                      borderRadius: 10,
                      background: submitting || !prenom.trim() ? "#8896A6" : C.prussian,
                      color: "#FFFFFF",
                      border: "none",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: submitting || !prenom.trim() ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      marginTop: 6,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                        Création de votre compte…
                      </>
                    ) : (
                      <>
                        Accéder à mon espace
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>

                  <p style={{ fontSize: 11, color: C.text3, textAlign: "center", margin: "8px 0 0", lineHeight: 1.5 }}>
                    En créant votre compte, vous acceptez nos{" "}
                    <a href="/legal/cgu" style={{ color: C.prussian, textDecoration: "none" }}>
                      conditions d&apos;utilisation
                    </a>{" "}
                    et notre{" "}
                    <a href="/legal/confidentialite" style={{ color: C.prussian, textDecoration: "none" }}>
                      politique de confidentialité
                    </a>.
                  </p>
                  <p style={{ fontSize: 11, color: C.text3, textAlign: "center", margin: 0 }}>
                    Lien valide jusqu&apos;au {expiresFormatted}.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </main>

      <footer style={{ padding: "16px 24px 32px", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: C.text3, margin: 0, letterSpacing: "0.04em" }}>
          ALTHY · l&apos;assistant immobilier suisse
        </p>
      </footer>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Atoms ────────────────────────────────────────────────────────────────

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 11,
        color: C.text3,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        marginBottom: 6,
        fontWeight: 600,
      }}
    >
      {children}
    </label>
  );
}

function FormInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { disabled } = props;
  return (
    <input
      {...props}
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "11px 14px",
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        fontSize: 14,
        fontFamily: "inherit",
        outline: "none",
        background: disabled ? "#F5F1E8" : "#FFFFFF",
        color: disabled ? C.text3 : C.text,
      }}
    />
  );
}

function StateMessage({
  icon: Icon,
  iconColor,
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div style={{ textAlign: "center", padding: "16px 0" }}>
      <Icon size={36} style={{ color: iconColor, margin: "0 auto 16px" }} />
      <h2 style={{ fontFamily: "var(--font-serif, Georgia, serif)", fontSize: 20, color: C.text, margin: "0 0 8px", fontWeight: 400 }}>
        {title}
      </h2>
      <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, margin: "0 0 24px" }}>{description}</p>
      <a
        href={ctaHref}
        style={{
          display: "inline-block",
          padding: "11px 26px",
          borderRadius: 10,
          background: C.prussian,
          color: "#FFFFFF",
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        {ctaLabel}
      </a>
    </div>
  );
}
