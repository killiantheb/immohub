"use client";

/**
 * Création avenant — Sprint 10 Lot 6.
 *
 * Form simple : sélection type → préformulaire selon type → submit (draft).
 * Champs `data` JSONB structurés selon `avenant_type`.
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCreateAvenant, type AvenantType } from "@/lib/hooks/useSprint10";
import { C } from "@/lib/design-tokens";

const TYPES: { value: AvenantType; label: string; hint?: string }[] = [
  { value: "animaux", label: "Autorisation d'animaux", hint: "Le bailleur autorise un animal de compagnie" },
  { value: "modification_loyer", label: "Modification du loyer", hint: "Indexation IPC, variation taux hypothécaire" },
  { value: "modification_date", label: "Modification de la date de fin" },
  { value: "prolongation", label: "Prolongation du bail" },
  { value: "resiliation_anticipee", label: "Résiliation anticipée (art. 264 CO)" },
  { value: "changement_proprietaire", label: "Changement de propriétaire (art. 261 CO)" },
  { value: "changement_locataire", label: "Changement de locataire" },
  { value: "charge_electrique", label: "Charge électrique" },
  { value: "accord_specifique", label: "Accord spécifique" },
];

export default function AvenantNewPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialContractId = sp.get("contract_id") ?? "";

  const [contractId, setContractId] = useState(initialContractId);
  const [type, setType] = useState<AvenantType>("animaux");
  const [objet, setObjet] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [data, setData] = useState<Record<string, unknown>>({});

  const mutation = useCreateAvenant();

  function updateData(key: string, value: unknown) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractId || !objet) return;
    try {
      const created = await mutation.mutateAsync({
        contract_id: contractId,
        avenant_type: type,
        objet,
        body_text: bodyText || null,
        effective_date: effectiveDate || null,
        data,
      });
      router.push(`/app/avenants/${created.id}`);
    } catch (e) {
      // useMutation error state handled below
    }
  }

  return (
    <div style={{ padding: "24px 0", maxWidth: 720 }}>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 400, color: C.text, margin: 0 }}>
        Nouvel avenant
      </h1>

      <form onSubmit={handleSubmit} style={{ marginTop: 24, display: "grid", gap: 16 }}>
        <Field label="ID du bail (contract_id)">
          <input
            type="text"
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            placeholder="uuid du contrat"
            required
            style={inputStyle}
          />
        </Field>

        <Field label="Type d'avenant">
          <select value={type} onChange={(e) => setType(e.target.value as AvenantType)} style={inputStyle}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Objet (court — affiché sur la liste)">
          <input
            type="text"
            value={objet}
            onChange={(e) => setObjet(e.target.value)}
            placeholder="ex: Autorisation chien Berger Australien"
            maxLength={200}
            required
            style={inputStyle}
          />
        </Field>

        <Field label="Date d'effet (optionnel)">
          <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} style={inputStyle} />
        </Field>

        {/* Champs spécifiques selon type */}
        {type === "animaux" && (
          <Field label="Type d'animal">
            <input
              type="text"
              placeholder="ex: un chien Berger Australien"
              onChange={(e) => updateData("animal_type", e.target.value)}
              style={inputStyle}
            />
          </Field>
        )}

        {type === "modification_loyer" && (
          <>
            <Field label="Ancien loyer (CHF)">
              <input type="number" step="0.01" onChange={(e) => updateData("ancien_loyer", parseFloat(e.target.value))} style={inputStyle} />
            </Field>
            <Field label="Nouveau loyer (CHF)">
              <input type="number" step="0.01" onChange={(e) => updateData("nouveau_loyer", parseFloat(e.target.value))} style={inputStyle} />
            </Field>
            <Field label="Motif">
              <input type="text" placeholder="ex: indexation IPC septembre 2026" onChange={(e) => updateData("motif", e.target.value)} style={inputStyle} />
            </Field>
          </>
        )}

        {(type === "modification_date" || type === "prolongation") && (
          <Field label="Nouvelle date de fin">
            <input type="date" onChange={(e) => updateData("nouvelle_date_fin", e.target.value)} style={inputStyle} />
          </Field>
        )}

        {type === "resiliation_anticipee" && (
          <>
            <Field label="Date de sortie effective">
              <input type="date" onChange={(e) => updateData("date_sortie", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Nom du locataire de reprise (présenté à l'agence)">
              <input type="text" onChange={(e) => updateData("nouveau_locataire_nom", e.target.value)} style={inputStyle} />
            </Field>
          </>
        )}

        {type === "changement_proprietaire" && (
          <>
            <Field label="Nouveau propriétaire (nom complet)">
              <input type="text" onChange={(e) => updateData("nouveau_proprietaire", e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Date d'effet">
              <input type="date" onChange={(e) => updateData("date_effet", e.target.value)} style={inputStyle} />
            </Field>
          </>
        )}

        {type === "charge_electrique" && (
          <Field label="Montant mensuel charge électrique (CHF)">
            <input type="number" step="0.01" onChange={(e) => updateData("montant_mensuel", parseFloat(e.target.value))} style={inputStyle} />
          </Field>
        )}

        <Field label="Corps libre (optionnel — précisions complémentaires)">
          <textarea rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />
        </Field>

        {mutation.isError && (
          <p style={{ color: "#991B1B", fontSize: 13 }}>
            Erreur lors de la création. Vérifiez le contract_id et les champs obligatoires.
          </p>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ padding: "10px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text2, fontSize: 13, fontWeight: 600 }}
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !contractId || !objet}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "none",
              background: C.prussian,
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              opacity: mutation.isPending || !contractId || !objet ? 0.5 : 1,
              cursor: mutation.isPending ? "not-allowed" : "pointer",
            }}
          >
            {mutation.isPending ? "Création…" : "Créer en brouillon"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 14,
  color: C.text,
  boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: C.text2, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
