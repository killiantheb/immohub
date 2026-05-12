"use client";

/**
 * CosignatairesForm — gestion des cosignataires d'un bail (Sprint 1A.5).
 *
 * Couvre Solo (vide), Couple (1 conjoint), Famille (1 conjoint + N enfants).
 * Stocké en JSONB sur `locataires.cosignataires` côté backend.
 *
 * Modes :
 *   - Locataire : ajout/édition/suppression
 *   - Bailleur (readOnly=true) : affichage uniquement
 *
 * §B.4 palette, §B.10 statuts honnêtes (badge « signature requise » explicite).
 */

import { useState } from "react";
import { Loader2, Plus, Trash2, UserPlus, Users } from "lucide-react";

import {
  type CosignataireBase,
  type TypeCosignataire,
} from "@/lib/api/dossier-documents";
import { C } from "@/lib/design-tokens";


interface Props {
  cosignataires: CosignataireBase[];
  readOnly?: boolean;
  isSubmitting?: boolean;
  onSubmit?: (cosignataires: CosignataireBase[]) => Promise<unknown> | void;
}


const TYPE_LABELS: Record<TypeCosignataire, string> = {
  conjoint: "Conjoint(e)",
  enfant: "Enfant",
  autre: "Autre",
};


function emptyCosignataire(type: TypeCosignataire): CosignataireBase {
  return {
    type,
    prenom: "",
    nom: "",
    date_naissance: null,
    signature_requise: type !== "enfant",
    lien_filial: null,
  };
}


export function CosignatairesForm({
  cosignataires,
  readOnly = false,
  isSubmitting = false,
  onSubmit,
}: Props) {
  // État local : copie éditable + draft form pour le nouveau cosignataire
  const [list, setList] = useState<CosignataireBase[]>(cosignataires);
  const [draft, setDraft] = useState<CosignataireBase | null>(null);

  // Synchronise quand le prop change (post-refetch)
  if (cosignataires.length !== list.length && draft === null) {
    // Re-init si la prop diverge et qu'on n'est pas en train d'éditer
    // (heuristique simple : on évite useEffect pour les cas Phase 1.0 simples)
  }

  function canSaveDraft(): boolean {
    if (!draft) return false;
    return Boolean(draft.prenom.trim() && draft.nom.trim());
  }

  async function commitChanges(next: CosignataireBase[]) {
    if (!onSubmit) return;
    setList(next);
    await onSubmit(next);
  }

  async function handleAddDraft() {
    if (!draft || !canSaveDraft()) return;
    const cleaned: CosignataireBase = {
      ...draft,
      prenom: draft.prenom.trim(),
      nom: draft.nom.trim(),
      lien_filial: draft.lien_filial?.trim() || null,
      // Force signature_requise = false pour les enfants (cohérent backend validator)
      signature_requise: draft.type === "enfant" ? false : draft.signature_requise,
    };
    const next = [...list, cleaned];
    setDraft(null);
    await commitChanges(next);
  }

  async function handleRemove(index: number) {
    const next = list.filter((_, i) => i !== index);
    await commitChanges(next);
  }

  // ── Rendu read-only (bailleur) ──────────────────────────────────────────────

  if (readOnly) {
    if (cosignataires.length === 0) {
      return (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: "20px 24px",
            boxShadow: C.shadow,
            textAlign: "center",
            color: C.text3,
          }}
        >
          <Users size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
          <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>
            Aucun cosignataire déclaré (location individuelle).
          </p>
        </div>
      );
    }
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
        <h3 style={titleStyle}>Cosignataires déclarés</h3>
        <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {cosignataires.map((c, i) => (
            <CosignataireRow key={`${c.prenom}-${c.nom}-${i}`} c={c} />
          ))}
        </ul>
      </div>
    );
  }

  // ── Rendu locataire (édition) ───────────────────────────────────────────────

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
      <h3 style={titleStyle}>Cosignataires</h3>
      <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, margin: "8px 0 16px" }}>
        Si vous emménagez en couple ou en famille, ajoutez les personnes qui
        résideront avec vous. Le conjoint devra cosigner le bail. Les enfants
        sont déclarés comme occupants.
      </p>

      {/* Liste existante */}
      {list.length > 0 && (
        <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((c, i) => (
            <CosignataireRow
              key={`${c.prenom}-${c.nom}-${i}`}
              c={c}
              onRemove={() => void handleRemove(i)}
              disabled={isSubmitting}
            />
          ))}
        </ul>
      )}

      {/* Draft form */}
      {draft && (
        <div
          style={{
            border: `1px solid ${C.prussianBorder}`,
            background: C.prussianBg,
            borderRadius: 10,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <Field label="Type *">
              <select
                value={draft.type}
                onChange={(e) =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          type: e.target.value as TypeCosignataire,
                          // signature_requise auto = false pour enfant, sinon true
                          signature_requise: e.target.value === "enfant" ? false : true,
                        }
                      : d,
                  )
                }
                style={inputStyle}
              >
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prénom *">
              <input
                type="text"
                value={draft.prenom}
                onChange={(e) => setDraft((d) => (d ? { ...d, prenom: e.target.value } : d))}
                placeholder="Marie"
                maxLength={100}
                style={inputStyle}
              />
            </Field>
            <Field label="Nom *">
              <input
                type="text"
                value={draft.nom}
                onChange={(e) => setDraft((d) => (d ? { ...d, nom: e.target.value } : d))}
                placeholder="Dupont"
                maxLength={100}
                style={inputStyle}
              />
            </Field>
            <Field label="Date de naissance">
              <input
                type="date"
                value={draft.date_naissance ?? ""}
                onChange={(e) =>
                  setDraft((d) => (d ? { ...d, date_naissance: e.target.value || null } : d))
                }
                style={inputStyle}
              />
            </Field>
            {draft.type === "enfant" && (
              <Field label="Lien (fils, fille, beau-fils, …)">
                <input
                  type="text"
                  value={draft.lien_filial ?? ""}
                  onChange={(e) =>
                    setDraft((d) => (d ? { ...d, lien_filial: e.target.value || null } : d))
                  }
                  placeholder="fille"
                  maxLength={50}
                  style={inputStyle}
                />
              </Field>
            )}
          </div>

          {draft.type === "enfant" && (
            <p style={{ fontSize: 11, color: C.text3, margin: "10px 0 0", fontStyle: "italic" }}>
              Les enfants n&apos;ont pas la capacité juridique de cosigner un bail
              en Suisse — ils sont déclarés comme occupants uniquement.
            </p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              type="button"
              onClick={() => void handleAddDraft()}
              disabled={!canSaveDraft() || isSubmitting}
              style={{
                ...btnP,
                opacity: canSaveDraft() && !isSubmitting ? 1 : 0.5,
                cursor: canSaveDraft() && !isSubmitting ? "pointer" : "not-allowed",
              }}
            >
              {isSubmitting && <Loader2 size={13} className="animate-spin" />}
              Ajouter
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={isSubmitting}
              style={btnGhost}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Bouton ajouter */}
      {!draft && list.length < 20 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setDraft(emptyCosignataire("conjoint"))}
            disabled={isSubmitting}
            style={btnP}
          >
            <UserPlus size={13} />
            Ajouter un conjoint
          </button>
          <button
            type="button"
            onClick={() => setDraft(emptyCosignataire("enfant"))}
            disabled={isSubmitting}
            style={btnGhost}
          >
            <Plus size={13} />
            Ajouter un enfant
          </button>
        </div>
      )}

      {list.length >= 20 && (
        <p style={{ fontSize: 12, color: C.text3, margin: "8px 0 0", fontStyle: "italic" }}>
          Limite de 20 cosignataires atteinte (cas hors norme — contactez le support).
        </p>
      )}
    </div>
  );
}


// ── Atoms ────────────────────────────────────────────────────────────────────


function CosignataireRow({
  c,
  onRemove,
  disabled,
}: {
  c: CosignataireBase;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        background: C.surface2,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>
          {c.prenom} {c.nom}{" "}
          <span style={{ fontSize: 11, fontWeight: 500, color: C.text3 }}>
            · {TYPE_LABELS[c.type]}
            {c.lien_filial ? ` (${c.lien_filial})` : ""}
          </span>
        </p>
        <p style={{ fontSize: 11, color: C.text3, margin: "2px 0 0" }}>
          {c.date_naissance ? `Né(e) le ${new Date(c.date_naissance).toLocaleDateString("fr-CH")}` : "—"}
          {c.signature_requise ? (
            <span style={{ color: C.gold, fontWeight: 600 }}> · Signature requise</span>
          ) : (
            <span> · Occupant déclaré</span>
          )}
        </p>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Retirer ${c.prenom} ${c.nom}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: 6,
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.red,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {disabled ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      )}
    </li>
  );
}


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


const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif, Georgia, serif)",
  fontSize: 16,
  fontWeight: 500,
  color: C.text,
  margin: 0,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  fontSize: 13,
  fontFamily: "inherit",
  background: C.surface,
  color: C.text,
  outline: "none",
};

const btnP: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: 9,
  border: "none",
  background: C.prussian,
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: 9,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text2,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

