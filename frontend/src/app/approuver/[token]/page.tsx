"use client";

/**
 * Page publique d'approbation propriétaire — Sprint 10 Lot 5.
 *
 * §2.4.16 décision #3 (Interprétation A) : le bailleur (proprio_solo) approuve
 * un candidat locataire issu d'une invitation existante via un magic_link
 * dédié `type='approbation_dossier'`. Pas de marketplace publique, pas de
 * candidature spontanée, pas de frais CHF 45.
 *
 * Workflow :
 *   1. GET /api/v1/public/approbation/{token} → synthèse anonymisée du dossier
 *      (nom candidat, métier, revenu, garanties, loyer mensuel, bien)
 *   2. Le bailleur clique « Approuver » → POST /approve → bail créé en draft +
 *      orchestrator Skribble (si activé) + email confirmation
 *   3. Ou « Refuser » → modale motif obligatoire → POST /deny + email candidat
 *
 * Pas d'auth requise — le token magic_link est le bearer scoped strict
 * (lecture/écriture sur ce dossier_id uniquement).
 *
 * Doctrine §B.4 palette Prussian #0F2E4C + Or #C9A961.
 * Doctrine §B.10 : statut "approved" affiché uniquement si la mutation backend
 *   a vraiment réussi (pas de faux success).
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { AlthyLogo } from "@/components/AlthyLogo";
import { C } from "@/lib/design-tokens";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "https://api.althy.ch/api/v1")
  .trim()
  .replace(/\/$/, "")
  .replace(/^http:\/\//, "https://");

const pub = axios.create({ baseURL: API_BASE });

interface PreviewResponse {
  dossier_id: string;
  candidate_full_name: string;
  candidate_dossier_summary: string;
  bien_address: string;
  monthly_rent: number | null;
  cosignataires_count: number;
  statut: "pending" | "approved" | "denied" | "expired" | "used" | "invalid";
  expires_at: string;
  owner_name: string;
}

function formatCHF(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("fr-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace(/ /g, "'") + " CHF";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function ApprouverPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [denyModalOpen, setDenyModalOpen] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    pub.get<PreviewResponse>(`/public/approbation/${token}`)
      .then((r) => setPreview(r.data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setError("Lien d'approbation introuvable ou invalide.");
        } else {
          setError("Impossible de charger le dossier. Veuillez réessayer.");
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function handleApprove() {
    setSubmitting(true);
    setActionError(null);
    try {
      const r = await pub.post<PreviewResponse>(
        `/public/approbation/${token}/approve`,
        {},
      );
      setPreview(r.data);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setActionError(typeof detail === "string" ? detail : "Erreur lors de l'approbation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeny() {
    if (denyReason.trim().length < 3) {
      setActionError("Le motif de refus doit comporter au moins 3 caractères.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const r = await pub.post<PreviewResponse>(
        `/public/approbation/${token}/deny`,
        { reason: denyReason.trim() },
      );
      setPreview(r.data);
      setDenyModalOpen(false);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setActionError(typeof detail === "string" ? detail : "Erreur lors du refus.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageShell>
        <div style={{ textAlign: "center", padding: "48px 16px" }}>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: C.prussian, margin: "0 auto" }} />
          <p style={{ marginTop: 16, color: C.text2 }}>Chargement du dossier…</p>
        </div>
      </PageShell>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <PageShell>
        <ErrorState message={error} />
      </PageShell>
    );
  }

  if (!preview) {
    return (
      <PageShell>
        <ErrorState message="Aucune donnée reçue du serveur." />
      </PageShell>
    );
  }

  // ── Terminal states ────────────────────────────────────────────────────────
  if (preview.statut === "approved") {
    return (
      <PageShell>
        <SuccessState
          icon="check"
          title="Approbation enregistrée"
          message={`Vous avez approuvé la candidature de ${preview.candidate_full_name} pour ${preview.bien_address}. Le bail va être créé et envoyé en signature électronique au locataire.`}
        />
      </PageShell>
    );
  }

  if (preview.statut === "denied") {
    return (
      <PageShell>
        <SuccessState
          icon="cross"
          title="Refus enregistré"
          message={`Vous avez refusé la candidature de ${preview.candidate_full_name}. Le locataire en a été informé.`}
        />
      </PageShell>
    );
  }

  if (preview.statut === "expired" || preview.statut === "used") {
    return (
      <PageShell>
        <ErrorState
          message={
            preview.statut === "expired"
              ? "Ce lien d'approbation a expiré. Demandez à l'agence d'en générer un nouveau."
              : "Ce lien a déjà été utilisé. Si vous avez besoin d'une nouvelle approbation, contactez l'agence."
          }
        />
      </PageShell>
    );
  }

  // ── Pending — show form ────────────────────────────────────────────────────
  return (
    <PageShell>
      <h1
        style={{
          fontFamily: "var(--font-serif, Georgia, serif)",
          fontSize: 26,
          fontWeight: 400,
          color: C.text,
          margin: "0 0 8px 0",
        }}
      >
        Approbation candidat locataire
      </h1>
      <p style={{ fontSize: 14, color: C.text2, marginBottom: 24 }}>
        Bonjour {preview.owner_name}, voici la synthèse du dossier candidat
        en attente de votre approbation.
      </p>

      <Card>
        <Field label="Candidat" value={preview.candidate_full_name} />
        <Field
          label="Synthèse du dossier"
          value={preview.candidate_dossier_summary}
        />
        <Field label="Bien concerné" value={preview.bien_address} />
        <Field label="Loyer mensuel proposé" value={formatCHF(preview.monthly_rent)} />
        {preview.cosignataires_count > 0 && (
          <Field
            label="Cosignataires"
            value={`${preview.cosignataires_count} (co-solidaire)`}
          />
        )}
        <Field label="Lien valable jusqu'au" value={formatDate(preview.expires_at)} />
      </Card>

      {actionError && (
        <div
          role="alert"
          style={{
            marginTop: 16,
            padding: "12px 16px",
            background: "#FEF2F2",
            color: "#991B1B",
            borderRadius: 8,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle className="h-4 w-4" />
          {actionError}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleApprove}
          disabled={submitting}
          style={{
            flex: "1 1 200px",
            padding: "14px 24px",
            background: C.prussian,
            color: "#fff",
            border: "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Approuver le candidat
        </button>
        <button
          type="button"
          onClick={() => setDenyModalOpen(true)}
          disabled={submitting}
          style={{
            flex: "0 1 auto",
            padding: "14px 24px",
            background: "transparent",
            color: "#991B1B",
            border: "1px solid #FCA5A5",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          Refuser
        </button>
      </div>

      <p style={{ marginTop: 24, fontSize: 12, color: C.text3, lineHeight: 1.6 }}>
        Cette synthèse est anonymisée selon les règles LPD — les pièces
        justificatives complètes (pièce d'identité, fiches de salaire,
        extrait des poursuites) restent consultables uniquement dans votre
        espace Althy authentifié.
      </p>

      {denyModalOpen && (
        <DenyModal
          reason={denyReason}
          setReason={setDenyReason}
          onClose={() => setDenyModalOpen(false)}
          onConfirm={handleDeny}
          submitting={submitting}
        />
      )}
    </PageShell>
  );
}


// ── Components ───────────────────────────────────────────────────────────────


function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F5F1E8",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px",
      }}
    >
      <header style={{ marginBottom: 32 }}>
        <AlthyLogo />
      </header>
      <main
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#FFFFFF",
          borderRadius: 14,
          padding: "32px 28px",
          boxShadow: "0 4px 18px rgba(15,46,76,0.08)",
        }}
      >
        {children}
      </main>
      <footer
        style={{
          marginTop: 24,
          fontSize: 11,
          color: C.text3,
          textAlign: "center",
          maxWidth: 480,
        }}
      >
        HBM Swiss Sàrl · althy.ch · l'assistant immobilier suisse
      </footer>
    </div>
  );
}


function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#F8F6F0",
        borderRadius: 10,
        padding: "20px 22px",
        marginTop: 12,
      }}
    >
      {children}
    </div>
  );
}


function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p
        style={{
          fontSize: 11,
          color: C.text3,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          margin: 0,
          marginBottom: 4,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 14, color: C.text, margin: 0, fontWeight: 600 }}>
        {value}
      </p>
    </div>
  );
}


function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 16px" }}>
      <AlertCircle
        className="h-12 w-12"
        style={{ color: "#991B1B", margin: "0 auto" }}
      />
      <h2 style={{ fontSize: 18, marginTop: 12, color: C.text }}>
        Impossible de charger l'approbation
      </h2>
      <p style={{ color: C.text2, fontSize: 14, marginTop: 8 }}>{message}</p>
    </div>
  );
}


function SuccessState({
  icon,
  title,
  message,
}: {
  icon: "check" | "cross";
  title: string;
  message: string;
}) {
  const Icon = icon === "check" ? CheckCircle2 : XCircle;
  const color = icon === "check" ? C.prussian : "#6B7280";
  return (
    <div style={{ textAlign: "center", padding: "32px 16px" }}>
      <Icon className="h-12 w-12" style={{ color, margin: "0 auto" }} />
      <h2
        style={{
          fontFamily: "var(--font-serif, Georgia, serif)",
          fontSize: 22,
          marginTop: 16,
          color: C.text,
          fontWeight: 400,
        }}
      >
        {title}
      </h2>
      <p style={{ color: C.text2, fontSize: 14, marginTop: 12, lineHeight: 1.65 }}>
        {message}
      </p>
    </div>
  );
}


function DenyModal({
  reason,
  setReason,
  onClose,
  onConfirm,
  submitting,
}: {
  reason: string;
  setReason: (s: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,46,76,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 12,
          maxWidth: 520,
          width: "100%",
          padding: 24,
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontSize: 18,
            color: C.text,
            margin: 0,
            marginBottom: 12,
          }}
        >
          Refuser ce candidat
        </h3>
        <p style={{ fontSize: 13, color: C.text2, marginBottom: 12, lineHeight: 1.5 }}>
          Merci d'indiquer une raison (interne — non visible par le candidat,
          mais utile pour vos archives et l'agence).
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex. : ratio loyer/revenu trop élevé, profession instable, contre-référence négative, etc."
          rows={4}
          disabled={submitting}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            fontSize: 13,
            fontFamily: "inherit",
            color: C.text,
            resize: "vertical",
            boxSizing: "border-box",
          }}
          maxLength={1000}
        />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.text2,
              fontSize: 13,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting || reason.trim().length < 3}
            style={{
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: "#991B1B",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting || reason.trim().length < 3 ? "not-allowed" : "pointer",
              opacity: submitting || reason.trim().length < 3 ? 0.55 : 1,
            }}
          >
            {submitting ? "Envoi…" : "Confirmer le refus"}
          </button>
        </div>
      </div>
    </div>
  );
}
