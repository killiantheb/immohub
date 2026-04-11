"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, FileText, X } from "lucide-react";

interface Props {
  /** Name of the property being applied for */
  propertyName: string;
  /** Landlord / property name for context */
  landlordName?: string;
  onConfirm: (consentedAt: string) => void;
  onCancel: () => void;
}

/**
 * Modal shown when a candidate submits their rental application.
 * The CHF 90 fee is charged ONLY if the candidate is retained — never upfront.
 * Stores consent timestamp passed back to parent for `dossier_fee_consented_at`.
 */
export function DossierFeeConsentModal({ propertyName, landlordName, onConfirm, onCancel }: Props) {
  const [accepted, setAccepted] = useState(false);

  function handleConfirm() {
    if (!accepted) return;
    onConfirm(new Date().toISOString());
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Consentement frais de dossier"
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(61,56,48,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div style={{
        background: "#FFFFFF", borderRadius: 16, padding: "28px 28px 24px",
        maxWidth: 480, width: "100%",
        boxShadow: "0 20px 60px rgba(61,56,48,0.25)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ background: "#FAE4D6", borderRadius: 10, padding: 10, flexShrink: 0 }}>
              <FileText style={{ color: "var(--althy-orange)", width: 20, height: 20 }} />
            </div>
            <div>
              <p style={{ margin: "0 0 2px", fontSize: 16, fontWeight: 700, color: "#3D3830" }}>
                Frais de dossier
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#7A7469" }}>
                {propertyName}{landlordName ? ` — ${landlordName}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#7A7469", padding: 4 }}
            aria-label="Fermer"
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Fee highlight */}
        <div style={{
          background: "#FAE4D6", borderRadius: 12, padding: "14px 16px",
          border: "1px solid #EDCFBE", marginBottom: 16,
        }}>
          <p style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "var(--althy-orange)" }}>CHF 90</p>
          <p style={{ margin: 0, fontSize: 13, color: "#5C2E0E", lineHeight: 1.5 }}>
            <strong>Uniquement si votre candidature est retenue.</strong>{" "}
            Aucun montant ne sera débité tant que le propriétaire ne vous a pas choisi.
          </p>
        </div>

        {/* Info boxes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {[
            { icon: "✅", text: "Votre carte de crédit est enregistrée à titre de garantie — aucun débit immédiat" },
            { icon: "❌", text: "Si votre dossier n'est pas retenu : aucun frais, carte non débitée" },
            { icon: "💳", text: "Si retenu : CHF 90 débités après confirmation du propriétaire" },
            { icon: "📋", text: "Conformément à l'art. 5 des CGU Althy et à l'OBLF suisse" },
          ].map(item => (
            <div key={item.icon} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, color: "#4A4440" }}>
              <span style={{ flexShrink: 0 }}>{item.icon}</span>
              <span style={{ lineHeight: 1.55 }}>{item.text}</span>
            </div>
          ))}
        </div>

        {/* Consent checkbox */}
        <label style={{
          display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
          padding: "12px 14px", borderRadius: 10,
          border: `1px solid ${accepted ? "var(--althy-orange)" : "#E8E4DC"}`,
          background: accepted ? "#FAE4D6" : "#FAFAF8",
          marginBottom: 16, transition: "all 0.15s",
        }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
            style={{ marginTop: 2, accentColor: "var(--althy-orange)", width: 15, height: 15, flexShrink: 0, cursor: "pointer" }}
          />
          <span style={{ fontSize: 12.5, color: "#3D3830", lineHeight: 1.55 }}>
            Je comprends que des frais de dossier de <strong>CHF 90</strong> me seront facturés{" "}
            <strong>uniquement si ma candidature est retenue</strong> par le propriétaire.{" "}
            J&apos;accepte les{" "}
            <Link href="/legal/cgu" target="_blank" style={{ color: "var(--althy-orange)" }}>CGU Althy</Link>.
          </span>
        </label>

        {!accepted && (
          <p style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--althy-orange)", marginBottom: 12 }}>
            <AlertCircle style={{ width: 13, height: 13, flexShrink: 0 }} />
            Veuillez accepter les conditions pour soumettre votre dossier.
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleConfirm}
            disabled={!accepted}
            style={{
              flex: 1, padding: "10px 16px",
              background: accepted ? "var(--althy-orange)" : "#D1CBC4",
              color: "#fff", border: "none", borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: accepted ? "pointer" : "not-allowed",
              transition: "background 0.15s",
            }}
          >
            Soumettre mon dossier
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "10px 16px", background: "transparent",
              color: "#7A7469", border: "1px solid #E8E4DC", borderRadius: 10,
              fontSize: 14, cursor: "pointer",
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
