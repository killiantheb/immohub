"use client";

/**
 * RenseignementsForm — étape 1 du dossier (15% progression).
 *
 * Saisie locataire de : emploi (employeur, poste, contrat, salaire, ancienneté)
 * + assurance RC (assureur, police, validité) + poursuites (résultat, date, office).
 *
 * Auto-flip backend : `renseignements_complets = TRUE` dès que le triptyque
 * (employeur, type_contrat, salaire_net) est rempli.
 *
 * Modes :
 *   - Création/édition : formulaire actif
 *   - Read-only (post-complétion) : affichage liste + bouton « Modifier »
 *
 * Palette §B.4 strict, 0 orange.
 */

import { useState } from "react";
import { CheckCircle2, Edit3, Loader2 } from "lucide-react";

import {
  type DossierMetaRead,
  type RenseignementsUpdate,
  type TypeContrat,
} from "@/lib/api/dossier-documents";
import { C } from "@/lib/design-tokens";


interface Props {
  dossier: DossierMetaRead | null;
  onSubmit: (payload: RenseignementsUpdate) => Promise<unknown> | void;
  isSubmitting?: boolean;
}


const TYPE_CONTRAT_LABELS: Record<TypeContrat, string> = {
  cdi: "CDI",
  cdd: "CDD",
  independant: "Indépendant",
  retraite: "Retraité",
  autre: "Autre",
};


export function RenseignementsForm({ dossier, onSubmit, isSubmitting = false }: Props) {
  const isComplete = Boolean(dossier?.renseignements_complets);
  const [editing, setEditing] = useState(!isComplete);
  const [form, setForm] = useState<RenseignementsUpdate>({
    employeur: dossier?.employeur ?? undefined,
    poste: dossier?.poste ?? undefined,
    type_contrat: (dossier?.type_contrat as TypeContrat | undefined) ?? undefined,
    salaire_net: dossier?.salaire_net ?? undefined,
    anciennete: dossier?.anciennete ?? undefined,
    assureur_rc: dossier?.assureur_rc ?? undefined,
    numero_police: dossier?.numero_police ?? undefined,
    validite_assurance: dossier?.validite_assurance ?? undefined,
  });
  const [success, setSuccess] = useState(false);

  const canSubmit =
    !!form.employeur?.trim() &&
    !!form.type_contrat &&
    form.salaire_net !== undefined &&
    form.salaire_net > 0 &&
    !isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSuccess(false);
    // On nettoie les undefined pour ne pas écraser les champs non touchés
    const payload: RenseignementsUpdate = {};
    for (const [k, v] of Object.entries(form) as [keyof RenseignementsUpdate, unknown][]) {
      if (v !== undefined && v !== "") {
        (payload as Record<string, unknown>)[k] = v;
      }
    }
    await onSubmit(payload);
    setSuccess(true);
    setEditing(false);
  }

  // ── Mode read-only (post-complétion) ─────────────────────────────────────────

  if (isComplete && !editing) {
    return (
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: C.shadow,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: 16,
              fontWeight: 500,
              color: C.text,
              margin: 0,
            }}
          >
            Renseignements de base
          </h3>
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text2,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Edit3 size={12} />
            Modifier
          </button>
        </div>

        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <InfoRow label="Employeur" value={dossier?.employeur ?? "—"} />
          {dossier?.poste && <InfoRow label="Poste" value={dossier.poste} />}
          <InfoRow
            label="Type de contrat"
            value={
              dossier?.type_contrat
                ? TYPE_CONTRAT_LABELS[dossier.type_contrat]
                : "—"
            }
          />
          <InfoRow
            label="Salaire net"
            value={dossier?.salaire_net ? `CHF ${Number(dossier.salaire_net).toLocaleString("fr-CH")}` : "—"}
          />
          {dossier?.anciennete != null && (
            <InfoRow label="Ancienneté" value={`${dossier.anciennete} mois`} />
          )}
          {dossier?.assureur_rc && (
            <InfoRow
              label="Assurance RC"
              value={
                dossier.numero_police
                  ? `${dossier.assureur_rc} · n° ${dossier.numero_police}`
                  : dossier.assureur_rc
              }
            />
          )}
        </dl>
      </div>
    );
  }

  // ── Mode édition ────────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "20px 24px",
        boxShadow: C.shadow,
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-serif, Georgia, serif)",
          fontSize: 16,
          fontWeight: 500,
          color: C.text,
          margin: "0 0 16px",
        }}
      >
        Renseignements de base
      </h3>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Employeur *">
          <input
            type="text"
            required
            value={form.employeur ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, employeur: e.target.value }))}
            placeholder="Banque Cantonale Vaudoise"
            maxLength={200}
            style={inputStyle}
          />
        </Field>
        <Field label="Poste">
          <input
            type="text"
            value={form.poste ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, poste: e.target.value }))}
            placeholder="Comptable"
            maxLength={200}
            style={inputStyle}
          />
        </Field>
        <Field label="Type de contrat *">
          <select
            required
            value={form.type_contrat ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, type_contrat: (e.target.value as TypeContrat) || undefined }))
            }
            style={inputStyle}
          >
            <option value="">Choisir…</option>
            {Object.entries(TYPE_CONTRAT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Salaire net (CHF/mois) *">
          <input
            type="number"
            required
            min={0}
            step={100}
            value={form.salaire_net ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                salaire_net: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
            placeholder="7500"
            style={inputStyle}
          />
        </Field>
        <Field label="Ancienneté (mois)">
          <input
            type="number"
            min={0}
            value={form.anciennete ?? ""}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                anciennete: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
            placeholder="36"
            style={inputStyle}
          />
        </Field>
        <div /> {/* spacer */}
        <Field label="Assureur RC">
          <input
            type="text"
            value={form.assureur_rc ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, assureur_rc: e.target.value }))}
            placeholder="AXA"
            maxLength={200}
            style={inputStyle}
          />
        </Field>
        <Field label="N° de police">
          <input
            type="text"
            value={form.numero_police ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, numero_police: e.target.value }))}
            placeholder="12345-678"
            maxLength={100}
            style={inputStyle}
          />
        </Field>
        <Field label="Validité de l'assurance">
          <input
            type="date"
            value={form.validite_assurance ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, validite_assurance: e.target.value || undefined }))
            }
            style={inputStyle}
          />
        </Field>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            borderRadius: 10,
            border: "none",
            background: canSubmit ? C.prussian : C.border,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: canSubmit ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          {isSubmitting && <Loader2 size={14} className="animate-spin" />}
          Sauvegarder mes renseignements
        </button>
        {isComplete && editing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text2,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Annuler
          </button>
        )}
        {success && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: C.green,
              fontSize: 13,
            }}
          >
            <CheckCircle2 size={14} />
            Étape 1 complétée — 15% débloqué !
          </span>
        )}
      </div>
    </form>
  );
}


// ── Atoms ────────────────────────────────────────────────────────────────────


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 11,
          color: C.text3,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 5,
          fontWeight: 600,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}


function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <span style={{ fontSize: 12, color: C.text3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{value}</span>
    </div>
  );
}


const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  fontSize: 13,
  fontFamily: "inherit",
  background: C.surface,
  color: C.text,
  outline: "none",
};
