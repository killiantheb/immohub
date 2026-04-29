"use client";

/**
 * Modale de confirmation pour la suppression (soft delete) d'un bien.
 *
 * Workflow :
 *   1. User clique "Supprimer" dans le header bien
 *   2. Modale demande de taper "SUPPRIMER" pour activer le bouton
 *   3. DELETE /biens/{id}
 *      - 200 : redirect vers /app/biens
 *      - 409 : afficher la liste des blockers (locataire actif, paiements,
 *              interventions actives) — l'utilisateur ferme et résout
 *      - autre : message d'erreur générique
 *
 * Soft delete strict (is_active=false) — pas de hard delete (cf
 * docs/6-LEGAL.md §6.10 : préservation traçabilité audit nLPD).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useDeleteBien } from "@/lib/hooks/useBiens";
import { C } from "@/lib/design-tokens";

interface Props {
  bienId: string;
  bienAdresse: string;
  onClose: () => void;
}

interface BlockersError {
  response?: {
    status?: number;
    data?: {
      detail?: { message?: string; blockers?: string[] };
    };
  };
}

export function DeleteBienModal({ bienId, bienAdresse, onClose }: Props) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);
  const deleteMutation = useDeleteBien();

  const isConfirmed = confirmation.toUpperCase().trim() === "SUPPRIMER";
  const isPending = deleteMutation.isPending;

  async function handleDelete() {
    setBlockers(null);
    setGenericError(null);
    try {
      await deleteMutation.mutateAsync(bienId);
      router.push("/app/biens");
      router.refresh();
    } catch (err) {
      const e = err as BlockersError;
      const status = e?.response?.status;
      if (status === 409) {
        const detail = e.response?.data?.detail;
        setBlockers(
          detail?.blockers && detail.blockers.length > 0
            ? detail.blockers
            : ["Suppression impossible"],
        );
      } else {
        setGenericError("Erreur lors de la suppression. Veuillez réessayer.");
      }
    }
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
          maxWidth: 460,
          width: "100%",
          padding: 24,
          boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: C.redBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} style={{ color: C.red }} />
            </div>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: C.text, margin: 0 }}>
              Supprimer ce bien ?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.text3,
              padding: 4,
              lineHeight: 0,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {blockers ? (
          <div>
            <p style={{ fontSize: 14, color: C.red, margin: "0 0 12px" }}>
              <strong>Suppression impossible.</strong> Vous devez d&apos;abord :
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {blockers.map((b, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 13,
                    color: C.text2,
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ color: C.red, flexShrink: 0 }}>•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%",
                marginTop: 18,
                padding: "10px 16px",
                borderRadius: 10,
                background: C.prussian,
                color: "#fff",
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Compris
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 13, color: C.text2, margin: 0 }}>
              Vous êtes sur le point d&apos;archiver le bien :
            </p>
            <p
              style={{
                fontWeight: 600,
                color: C.text,
                background: C.prussianBg,
                padding: "10px 14px",
                borderRadius: 10,
                margin: 0,
                fontSize: 14,
              }}
            >
              {bienAdresse}
            </p>
            <p style={{ fontSize: 12, color: C.text3, margin: 0, lineHeight: 1.5 }}>
              Cette action archive le bien (soft delete). Il disparaîtra de votre
              liste mais reste consultable pour audit. Restauration possible
              Phase 2.
            </p>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: C.text3,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}
              >
                Tapez <strong>SUPPRIMER</strong> pour confirmer
              </label>
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="SUPPRIMER"
                autoFocus
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${isConfirmed ? C.red : C.border}`,
                  fontSize: 14,
                  fontFamily: "inherit",
                  outline: "none",
                  background: C.surface,
                  color: C.text,
                }}
              />
            </div>

            {genericError && (
              <p style={{ fontSize: 12, color: C.red, margin: 0 }}>{genericError}</p>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: C.surface,
                  color: C.text2,
                  fontSize: 14,
                  cursor: isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!isConfirmed || isPending}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: !isConfirmed || isPending ? "#fca5a5" : C.red,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: !isConfirmed || isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {isPending && <Loader2 size={14} className="animate-spin" />}
                {isPending ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
