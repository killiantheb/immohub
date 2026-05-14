"use client";

/**
 * CountersignModal — Sprint 8 Lot C — Contre-signature locataire d'un bail.
 * Mis à jour 2026-05-14 (doctrine Sprint 10, cf docs/2-ROADMAP.md §2.4.16).
 *
 * Workflow Phase 1.0 (doctrine §B.10) :
 *   1. Le bailleur accepte le bail depuis /app/contracts/[id] → signed_at posé.
 *   2. Le locataire voit son bail dans /app/mon-bien et ouvre cette modale.
 *   3. Modal : prévisualisation PDF (iframe) + champ nom complet + case d'acceptation.
 *   4. Submit → POST /contracts/{id}/countersign (backend Lot A pose
 *      tenant_signed_at + tenant_signed_ip) → fully_signed = true côté backend.
 *
 * §B.10 — vocabulaire honnête : "acceptation contractuelle" horodatée +
 * IP + nom saisi. Sémantique SES suisse (art. 14 al. 1 CO) suffisante pour
 * baux d'habitation civils.
 *
 * Coexiste avec Plan A Skribble SES (Sprint 10) — quand
 * `process.env.NEXT_PUBLIC_SKRIBBLE_ENABLED=true` ou le contract a un
 * `skribble_session_id`, l'UI redirige vers le flow Skribble. Cette
 * modale reste utilisable comme **Plan B fallback admin**.
 */

import { useState } from "react";
import { X, FileText } from "lucide-react";
import type { Contract } from "@/lib/types";
import { useCountersignContract } from "@/lib/hooks/useContracts";
import { C } from "@/lib/design-tokens";
import { TYPO_LABEL_MEDIUM, TYPO_CAPTION } from "@/lib/typography";

interface CountersignModalProps {
  contract: Contract;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CountersignModal({ contract, onClose, onSuccess }: CountersignModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [fullName, setFullName] = useState("");

  const mutation = useCountersignContract();

  const canSubmit = accepted && fullName.trim().length > 3 && !mutation.isPending;

  function handleSubmit() {
    if (!canSubmit) return;
    mutation.mutate(contract.id, {
      onSuccess: () => {
        onSuccess?.();
        onClose();
      },
    });
  }

  const errorMessage = mutation.isError
    ? (mutation.error instanceof Error ? mutation.error.message : "Une erreur est survenue.")
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="countersign-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 46, 76, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !mutation.isPending) onClose();
      }}
    >
      <div
        style={{
          background: C.surface,
          borderRadius: 14,
          maxWidth: 640,
          width: "100%",
          padding: 28,
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: C.shadowLg,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
          <div>
            <h2
              id="countersign-title"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                fontWeight: 400,
                color: C.text,
                margin: 0,
              }}
            >
              Contre-signature du bail
            </h2>
            <p style={{ fontSize: 13, color: C.text3, margin: "4px 0 0" }}>
              Réf. {contract.reference}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            aria-label="Fermer"
            style={{
              background: "transparent",
              border: "none",
              cursor: mutation.isPending ? "not-allowed" : "pointer",
              color: C.text3,
              padding: 4,
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: 16 }}>
          En cliquant sur <strong>« J&apos;accuse réception et j&apos;accepte »</strong>, vous
          confirmez avoir lu et accepté l&apos;intégralité du bail ci-dessous. Votre
          adresse IP et l&apos;horodatage seront enregistrés comme preuve d&apos;acceptation.
        </p>

        {/* PDF preview */}
        {contract.pdf_url ? (
          <iframe
            src={contract.pdf_url}
            title="Aperçu du bail"
            style={{
              width: "100%",
              height: 380,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              marginBottom: 16,
            }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px 16px",
              border: `1px dashed ${C.border}`,
              borderRadius: 10,
              marginBottom: 16,
              color: C.text3,
              fontSize: 13,
            }}
          >
            <FileText className="h-4 w-4" />
            Le PDF du bail n&apos;est pas encore disponible. Contactez votre bailleur.
          </div>
        )}

        {/* Nom complet */}
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="countersign-name" style={{ ...TYPO_LABEL_MEDIUM, color: C.text2, display: "block", marginBottom: 6 }}>
            Nom complet (pour acceptation)
          </label>
          <input
            id="countersign-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Prénom Nom"
            disabled={mutation.isPending}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text,
              fontSize: 14,
              outline: "none",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            cursor: mutation.isPending ? "not-allowed" : "pointer",
            marginBottom: 20,
          }}
        >
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            disabled={mutation.isPending}
            style={{ marginTop: 3, width: 16, height: 16, accentColor: C.prussian }}
          />
          <span style={{ ...TYPO_CAPTION, color: C.text2, lineHeight: 1.5 }}>
            J&apos;accuse réception du bail et j&apos;accepte l&apos;ensemble des termes et
            conditions énoncés dans ce document.
          </span>
        </label>

        {errorMessage && (
          <p style={{ fontSize: 13, color: C.red, marginBottom: 14 }}>
            {errorMessage}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text2,
              fontSize: 13,
              fontWeight: 600,
              cursor: mutation.isPending ? "not-allowed" : "pointer",
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: C.prussian,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            {mutation.isPending ? "Envoi…" : "J'accuse réception et j'accepte"}
          </button>
        </div>
      </div>
    </div>
  );
}
