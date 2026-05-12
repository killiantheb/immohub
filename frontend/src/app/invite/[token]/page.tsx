"use client";

/**
 * Page publique d'acceptation invitation locataire — Sprint 1C.
 * Phase 1.0 doctrine v6 §4.7.
 *
 * Workflow (PR-3-invite-password-flow 2026-05-13) :
 *   1. GET /api/v1/invite/{token}/preview → pré-remplit prenom/nom/email +
 *      affiche bailleur_nom + bien_adresse
 *   2. Si statut === "used" → message "Lien déjà utilisé, connectez-vous"
 *      Si statut === "expired" → message "Lien expiré, demandez un nouveau"
 *      Si statut === "pending" → form de création de compte
 *   3. Submit → POST /onboarding/rejoindre {token, prenom, nom, email,
 *      password, confirm_password} → backend crée user Supabase avec ce
 *      password + Locataire lié au bien.
 *   4. Sur 200 → supabase.auth.signInWithPassword({email, password}) côté
 *      client → cookies session posés sur althy.ch → router.push("/app/mon-bien").
 *
 * Doctrine §4.7 « Création compte locataire (email + mot de passe Supabase
 * Auth) » + §B.10 (pas de faux statut, erreurs claires) + §B.15 (Resend
 * uniquement, plus de dépendance Supabase magic link signin).
 * Branding : §B.4 — bleu Prusse + or.
 * Pas d'auth requise (route hors PROTECTED_PREFIXES middleware).
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import { AlthyLogo } from "@/components/AlthyLogo";
import { createClient } from "@/lib/supabase";
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
  redirect_to: string;
}

const PASSWORD_MIN = 8;

export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<React.ReactNode | null>(null);

  // Validation live
  const passwordOk = password.length >= PASSWORD_MIN;
  const confirmOk = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit =
    !!prenom.trim() && passwordOk && confirmOk && !submitting;

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
    if (!preview || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // 1. Crée le user Supabase + Locataire côté backend (admin API).
      await pub.post<RejoindreResponse>("/onboarding/rejoindre", {
        token,
        prenom: prenom.trim(),
        nom: nom.trim(),
        email: preview.target_email,
        password,
        confirm_password: confirmPassword,
      });

      // 2. Signin côté client avec le même password → pose les cookies session
      //    sur le domaine althy.ch (cf doctrine §4.7 + §B.10 — pas de dépendance
      //    Supabase magic link signin / Redirect URLs allowlist).
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: preview.target_email,
        password,
      });

      if (signInError) {
        // Le compte EST créé en DB (§B.10 — pas de mensonge : on ne dit pas
        // "compte non créé"). On guide vers /login pour reconnexion manuelle.
        setSubmitError(
          "Compte créé, mais la connexion automatique a échoué. " +
            "Connectez-vous manuellement via la page de connexion.",
        );
        setSubmitting(false);
        return;
      }

      // 3. Redirect vers l'espace locataire dédié (§4.7).
      router.push("/app/mon-bien");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string }; status?: number } })?.response;
      const msg = detail?.data?.detail;
      if (detail?.status === 409) {
        // Email déjà pris côté Supabase Auth (cf bug-invitation-001 fix
        // 2026-05-13). Doctrine §4.7bis : 1 email = 1 compte = 1 rôle
        // Phase 1.0. Multi-rôles Phase 1.1 → support manuel pour le moment.
        setSubmitError(
          <>
            Cet email a déjà un compte Althy. Pour l&apos;utiliser comme
            locataire de ce bien, contactez{" "}
            <a
              href="/contact"
              style={{ color: C.prussian, textDecoration: "underline", fontWeight: 600 }}
            >
              le support althy.ch
            </a>
            .
          </>,
        );
      } else if (detail?.status === 410) {
        setSubmitError("Ce lien a expiré. Demandez un nouveau lien à votre bailleur.");
      } else if (detail?.status === 404) {
        setSubmitError("Ce lien est invalide.");
      } else if (detail?.status === 400) {
        setSubmitError(msg || "Données invalides — vérifiez votre mot de passe.");
      } else if (detail?.status === 422) {
        setSubmitError("Le mot de passe doit faire au moins 8 caractères.");
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

                  <div>
                    <FormLabel>Mot de passe *</FormLabel>
                    <PasswordInput
                      value={password}
                      onChange={setPassword}
                      visible={showPassword}
                      onToggleVisible={() => setShowPassword((v) => !v)}
                      placeholder="Au moins 8 caractères"
                      autoComplete="new-password"
                    />
                    <PasswordHint ok={passwordOk} label="8 caractères minimum" />
                  </div>

                  <div>
                    <FormLabel>Confirmer le mot de passe *</FormLabel>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      visible={showConfirm}
                      onToggleVisible={() => setShowConfirm((v) => !v)}
                      placeholder="Retapez votre mot de passe"
                      autoComplete="new-password"
                    />
                    {confirmPassword.length > 0 && (
                      <PasswordHint
                        ok={confirmOk}
                        label={
                          confirmOk
                            ? "Les mots de passe correspondent"
                            : "Les mots de passe ne correspondent pas"
                        }
                      />
                    )}
                  </div>

                  {submitError && (
                    <p style={{ fontSize: 12, color: C.red, margin: 0, padding: "8px 12px", background: C.redBg, borderRadius: 8 }}>
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    style={{
                      padding: "14px 28px",
                      borderRadius: 10,
                      background: !canSubmit ? "#8896A6" : C.prussian,
                      color: "#FFFFFF",
                      border: "none",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: !canSubmit ? "not-allowed" : "pointer",
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
                        Créer mon compte et accéder à mon espace
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

function PasswordInput({
  value,
  onChange,
  visible,
  onToggleVisible,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={PASSWORD_MIN}
        placeholder={placeholder}
        autoComplete={autoComplete}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "11px 40px 11px 14px",
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          fontSize: 14,
          fontFamily: "inherit",
          outline: "none",
          background: "#FFFFFF",
          color: C.text,
        }}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: C.text3,
          padding: 4,
          display: "flex",
          alignItems: "center",
        }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function PasswordHint({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      style={{
        marginTop: 6,
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: ok ? C.green : C.text3,
      }}
    >
      <CheckCircle2 size={12} style={{ color: ok ? C.green : C.text3, opacity: ok ? 1 : 0.4 }} />
      <span>{label}</span>
    </div>
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
