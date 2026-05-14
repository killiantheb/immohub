"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useCreateResiliation, type ResiliationInitiateur } from "@/lib/hooks/useSprint10";
import { C } from "@/lib/design-tokens";

export default function ResiliationNewPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialContractId = sp.get("contract_id") ?? "";

  const [contractId, setContractId] = useState(initialContractId);
  const [initiateur, setInitiateur] = useState<ResiliationInitiateur>("locataire");
  const [motif, setMotif] = useState("");
  const [dateResiliation, setDateResiliation] = useState("");
  const [dateEnvoi, setDateEnvoi] = useState(new Date().toISOString().slice(0, 10));
  const [respectPreavis, setRespectPreavis] = useState(true);
  const [preavisMonths, setPreavisMonths] = useState(3);

  const mutation = useCreateResiliation();
  const [warning, setWarning] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractId || !dateResiliation) return;
    try {
      const created = (await mutation.mutateAsync({
        contract_id: contractId,
        initiateur,
        motif: motif || null,
        date_resiliation: dateResiliation,
        date_envoi: dateEnvoi,
        respect_preavis: respectPreavis,
        preavis_months: preavisMonths,
      })) as any;
      if (created?.warning_co_266l) {
        setWarning(created.warning_message);
        setTimeout(() => router.push(`/app/resiliations/${created.id}`), 4000);
      } else {
        router.push(`/app/resiliations/${created.id}`);
      }
    } catch (e) {
      // error handled
    }
  }

  const showCo266lPrewarning = initiateur === "bailleur";

  return (
    <div style={{ padding: "24px 0", maxWidth: 720 }}>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 400, color: C.text, margin: 0 }}>
        Nouvelle résiliation
      </h1>

      {showCo266lPrewarning && (
        <div style={{ marginTop: 16, padding: "14px 18px", background: "#FFF6E5", borderLeft: "3px solid #C9A961", borderRadius: 4, display: "flex", gap: 10, color: "#7A6428", fontSize: 13, lineHeight: 1.5 }}>
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Pour les baux d'habitation</strong>, la formule officielle cantonale CO 266l reste <strong>obligatoire</strong> pour le bailleur. Ce document Althy documente la décision mais ne remplace PAS la formule officielle qui doit être transmise en parallèle par lettre recommandée.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 24, display: "grid", gap: 16 }}>
        <Field label="ID du bail (contract_id)">
          <input type="text" value={contractId} onChange={(e) => setContractId(e.target.value)} required style={inputStyle} />
        </Field>

        <Field label="Initiateur de la résiliation">
          <select value={initiateur} onChange={(e) => setInitiateur(e.target.value as ResiliationInitiateur)} style={inputStyle}>
            <option value="locataire">Locataire</option>
            <option value="bailleur">Bailleur (propriétaire)</option>
            <option value="agence_mandataire">Agence-mandataire</option>
          </select>
        </Field>

        <Field label="Motif (optionnel, 200 chars max)">
          <input type="text" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={200} style={inputStyle} />
        </Field>

        <Field label="Date de résiliation effective">
          <input type="date" value={dateResiliation} onChange={(e) => setDateResiliation(e.target.value)} required style={inputStyle} />
        </Field>

        <Field label="Date d'envoi du courrier">
          <input type="date" value={dateEnvoi} onChange={(e) => setDateEnvoi(e.target.value)} required style={inputStyle} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field label="Préavis respecté ?">
            <select value={respectPreavis ? "yes" : "no"} onChange={(e) => setRespectPreavis(e.target.value === "yes")} style={inputStyle}>
              <option value="yes">Oui (résiliation ordinaire)</option>
              <option value="no">Non (résiliation extraordinaire)</option>
            </select>
          </Field>
          <Field label="Préavis (mois)">
            <input type="number" min={0} max={12} value={preavisMonths} onChange={(e) => setPreavisMonths(parseInt(e.target.value) || 0)} style={inputStyle} />
          </Field>
        </div>

        {mutation.isError && (
          <p style={{ color: "#991B1B", fontSize: 13 }}>Erreur lors de la création.</p>
        )}

        {warning && (
          <div style={{ padding: 14, background: "#FFF6E5", borderLeft: "3px solid #C9A961", borderRadius: 4, color: "#7A6428", fontSize: 13 }}>
            {warning} <br /><em>Redirection en cours…</em>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => router.back()} style={{ padding: "10px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text2, fontSize: 13, fontWeight: 600 }}>
            Annuler
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !contractId || !dateResiliation}
            style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: C.prussian, color: "#fff", fontSize: 14, fontWeight: 700, opacity: mutation.isPending || !contractId || !dateResiliation ? 0.5 : 1, cursor: mutation.isPending ? "not-allowed" : "pointer" }}
          >
            {mutation.isPending ? "Création…" : "Enregistrer la résiliation"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, color: C.text, boxSizing: "border-box",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, color: C.text2, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
