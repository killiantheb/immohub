"use client";

/**
 * RejectDocumentModal — modal bailleur pour rejeter un document avec raison.
 *
 * §B.10 : commentaire obligatoire min 5 caractères (validation client + backend).
 * §B.4 : palette Prussian/Or, 0 orange.
 */

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, X } from "lucide-react";

import { C } from "@/lib/design-tokens";


interface Props {
  documentLabel: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (commentaire: string) => Promise<void> | void;
}

export function RejectDocumentModal({
  documentLabel,
  isSubmitting = false,
  onClose,
  onConfirm,
}: Props) {
  const [commentaire, setCommentaire] = useState("");
  const [error, setError] = useState<string | null>(null);

  const trimmed = commentaire.trim();
  const canSubmit = trimmed.length >= 5 && !isSubmitting;

  // Escape pour fermer (UX standard modale)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, isSubmitting]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data
        ?.detail;
      setError(msg ?? "Erreur lors du rejet. Réessayez.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-document-title"
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 46, 76, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: C.surface,
          borderRadius: 14,
          boxShadow: "0 12px 40px rgba(15,46,76,0.25)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            id="reject-document-title"
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: 17,
              color: C.text,
              margin: 0,
              fontWeight: 500,
            }}
          >
            Rejeter ce document
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fermer"
            style={{
              background: "transparent",
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              color: C.text3,
              display: "inline-flex",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <p style={{ fontSize: 13, color: C.text2, margin: "0 0 16px", lineHeight: 1.5 }}>
            Le locataire verra le motif que vous saisissez ci-dessous. Soyez factuel
            et précis (ex : « fiche illisible, merci de réuploader en meilleure
            résolution »).
          </p>

          <p
            style={{
              fontSize: 11,
              color: C.text3,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 6px",
              fontWeight: 600,
            }}
          >
            Document concerné
          </p>
          <p
            style={{
              fontSize: 13,
              color: C.text,
              margin: "0 0 16px",
              padding: "10px 14px",
              background: C.surface2,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
            }}
          >
            {documentLabel}
          </p>

          <label
            htmlFor="reject-commentaire"
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
            Motif du rejet *
          </label>
          <textarea
            id="reject-commentaire"
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            placeholder="Minimum 5 caractères"
            rows={4}
            disabled={isSubmitting}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              resize: "vertical",
              minHeight: 80,
              color: C.text,
              background: C.surface,
            }}
          />
          <p style={{ fontSize: 11, color: C.text3, margin: "4px 0 0" }}>
            {trimmed.length}/2000 caractères
          </p>

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: C.redBg,
                color: C.red,
                fontSize: 12,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            padding: "12px 20px 18px",
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            borderTop: `1px solid ${C.border}`,
            background: C.surface2,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text,
              fontSize: 13,
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: canSubmit ? C.red : C.border,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {isSubmitting && <Loader2 size={14} className="animate-spin" />}
            Confirmer le rejet
          </button>
        </div>
      </div>
    </div>
  );
}
