"use client";

/**
 * Modale "Inviter le locataire" — Sprint 1C (Phase 1.0 doctrine v6 §4.7).
 *
 * Workflow :
 *   1. Bailleur ouvre la modale depuis la fiche bien (TabLocataire Empty state).
 *   2. Saisit email + prenom? + nom? + mode_envoi (email / qr / lien) + message?
 *   3. Submit → POST /api/v1/biens/{bien_id}/inviter-locataire (Sprint 1B).
 *   4. Selon mode :
 *        - email : confirmation "Email envoyé à X"
 *        - qr    : QR code affiché + bouton "Télécharger PNG"
 *        - lien  : URL affichée + bouton "Copier"
 *      + bouton "Inviter un autre locataire" pour colocation (cf §4.7
 *        politique max comptes : 1 invitation par coloc).
 *
 * Pattern modale centrée 520px, calqué sur DeleteBienModal pour cohérence DA.
 */

import { useState } from "react";
import { Copy, Loader2, Mail, QrCode, Send, UserPlus, X, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

type ModeEnvoi = "email" | "qr" | "lien";

interface InvitationResponse {
  invitation_id: string;
  token: string;
  invitation_url: string;
  qr_code_data_uri: string | null;
  email_sent: boolean;
  already_existed: boolean;
  expires_at: string;
}

interface Props {
  bienId: string;
  bienAdresseCourte?: string;
  onClose: () => void;
}

export function InviterLocataireModal({ bienId, bienAdresseCourte, onClose }: Props) {
  const [step, setStep] = useState<"form" | "success">("form");
  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [mode, setMode] = useState<ModeEnvoi>("email");
  const [messagePersonnel, setMessagePersonnel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<InvitationResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<InvitationResponse>(
        `/biens/${bienId}/inviter-locataire`,
        {
          email: email.trim().toLowerCase(),
          prenom: prenom.trim() || null,
          nom: nom.trim() || null,
          mode_envoi: mode,
          message_personnel: messagePersonnel.trim() || null,
        },
      );
      setResponse(res.data);
      setStep("success");
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "Erreur lors de la création de l'invitation. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!response) return;
    navigator.clipboard.writeText(response.invitation_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    setStep("form");
    setEmail("");
    setPrenom("");
    setNom("");
    setMessagePersonnel("");
    setResponse(null);
    setError(null);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          maxWidth: 520,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
          boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: C.prussianBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <UserPlus size={20} style={{ color: C.prussian }} />
            </div>
            <div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: C.text, margin: 0 }}>
                Inviter le locataire
              </h2>
              {bienAdresseCourte && (
                <p style={{ fontSize: 12, color: C.text3, margin: "2px 0 0" }}>{bienAdresseCourte}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.text3, padding: 4, lineHeight: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {step === "form" && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
              Le locataire recevra un lien unique pour créer son espace dédié à ce bien.
              Ce lien expire dans 7 jours.
            </p>

            {/* Email */}
            <div>
              <Label>Email du locataire *</Label>
              <Input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="marie@example.ch"
              />
            </div>

            {/* Prenom + Nom */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <Label>Prénom</Label>
                <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Marie" />
              </div>
              <div>
                <Label>Nom</Label>
                <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Dupont" />
              </div>
            </div>

            {/* Message personnel */}
            <div>
              <Label>Message personnel (optionnel)</Label>
              <textarea
                value={messagePersonnel}
                onChange={(e) => setMessagePersonnel(e.target.value.slice(0, 500))}
                placeholder="Bienvenue dans votre nouveau logement…"
                rows={2}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                  background: C.surface,
                  color: C.text,
                  resize: "vertical",
                }}
              />
              <p style={{ fontSize: 11, color: C.text3, margin: "4px 0 0" }}>{messagePersonnel.length}/500</p>
            </div>

            {/* Mode envoi */}
            <div>
              <Label>Mode d&apos;envoi</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                <ModeButton icon={Mail}    label="Email"  active={mode === "email"} onClick={() => setMode("email")} />
                <ModeButton icon={QrCode}  label="QR"     active={mode === "qr"}    onClick={() => setMode("qr")} />
                <ModeButton icon={Send}    label="Lien"   active={mode === "lien"}  onClick={() => setMode("lien")} />
              </div>
              <p style={{ fontSize: 11, color: C.text3, margin: "6px 0 0", lineHeight: 1.4 }}>
                {mode === "email" && "Email envoyé via Resend avec lien d'invitation."}
                {mode === "qr" && "QR code à imprimer (à coller sur l'EDL papier ou la porte)."}
                {mode === "lien" && "URL à copier-coller (WhatsApp, SMS, email perso…)."}
              </p>
            </div>

            {error && (
              <p style={{ fontSize: 12, color: C.red, margin: 0, padding: "8px 12px", background: C.redBg, borderRadius: 8 }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={btnSecondary(loading)}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                style={btnPrimary(loading || !email.trim())}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? "Création…" : "Créer l'invitation"}
              </button>
            </div>
          </form>
        )}

        {step === "success" && response && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Confirmation banner */}
            <div
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 10,
                background: response.already_existed ? C.amberBg : C.greenBg,
                alignItems: "flex-start",
              }}
            >
              <CheckCircle2 size={18} style={{ color: response.already_existed ? C.amber : C.green, flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: C.text }}>
                <strong>
                  {response.already_existed
                    ? "Invitation déjà existante"
                    : mode === "email"
                    ? response.email_sent
                      ? "Email envoyé"
                      : "Invitation créée (email non envoyé)"
                    : "Invitation créée"}
                </strong>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: C.text2 }}>
                  Expire le{" "}
                  {new Date(response.expires_at).toLocaleDateString("fr-CH", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Mode-specific content */}
            {mode === "qr" && response.qr_code_data_uri && (
              <div style={{ textAlign: "center" }}>
                <img
                  src={response.qr_code_data_uri}
                  alt="QR code invitation"
                  style={{
                    maxWidth: 280,
                    width: "100%",
                    height: "auto",
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    padding: 12,
                    background: "#fff",
                  }}
                />
                <a
                  href={response.qr_code_data_uri}
                  download={`invitation-locataire-${response.invitation_id.slice(0, 8)}.png`}
                  style={{
                    display: "inline-block",
                    marginTop: 12,
                    fontSize: 13,
                    color: C.prussian,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Télécharger PNG ↓
                </a>
              </div>
            )}

            {/* URL copy box (toujours visible quel que soit le mode) */}
            <div>
              <Label>Lien d&apos;invitation</Label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  value={response.invitation_url}
                  readOnly
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    fontSize: 12,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    background: C.prussianBg,
                    color: C.text,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    padding: "0 14px",
                    borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    background: copied ? C.greenBg : C.surface,
                    color: copied ? C.green : C.text2,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  <Copy size={14} />
                  {copied ? "Copié" : "Copier"}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button type="button" onClick={handleReset} style={btnSecondary(false)}>
                Inviter un autre locataire
              </button>
              <button type="button" onClick={onClose} style={btnPrimary(false)}>
                Terminé
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Atoms ───────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
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

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        fontSize: 14,
        fontFamily: "inherit",
        outline: "none",
        background: C.surface,
        color: C.text,
      }}
    />
  );
}

function ModeButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "10px 8px",
        borderRadius: 10,
        border: `1.5px solid ${active ? C.prussian : C.border}`,
        background: active ? C.prussianBg : C.surface,
        color: active ? C.prussian : C.text2,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "10px 16px",
    borderRadius: 10,
    border: "none",
    background: disabled ? "#8896A6" : C.prussian,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };
}

function btnSecondary(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "10px 16px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.text2,
    fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  };
}
