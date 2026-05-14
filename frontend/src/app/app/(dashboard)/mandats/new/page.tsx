"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateMandat } from "@/lib/hooks/useSprint10";
import { C } from "@/lib/design-tokens";

export default function MandatNewPage() {
  const router = useRouter();

  const [mandantId, setMandantId] = useState("");
  const [agenceId, setAgenceId] = useState("");
  const [bienId, setBienId] = useState("");
  const [commissionAnnee, setCommissionAnnee] = useState(10);
  const [commissionSaison, setCommissionSaison] = useState(15);
  const [commissionSemaine, setCommissionSemaine] = useState(20);
  const [forJuridique, setForJuridique] = useState("Sierre");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [noticePeriodMonths, setNoticePeriodMonths] = useState(3);
  const [noticeDeadlineMonthDay, setNoticeDeadlineMonthDay] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useCreateMandat();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mandantId || !agenceId || !startDate) return;
    try {
      const created = await mutation.mutateAsync({
        mandant_id: mandantId,
        agence_id: agenceId,
        bien_id: bienId || null,
        commission_pct_annee: commissionAnnee,
        commission_pct_saison: commissionSaison,
        commission_pct_semaine: commissionSemaine,
        notes: notes || null,
        for_juridique: forJuridique,
        start_date: startDate,
        end_date: endDate || null,
        notice_period_months: noticePeriodMonths,
        notice_deadline_month_day: noticeDeadlineMonthDay || null,
      });
      router.push(`/app/mandats/${created.id}`);
    } catch (e) {
      // error handled
    }
  }

  return (
    <div style={{ padding: "24px 0", maxWidth: 720 }}>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 400, color: C.text, margin: 0 }}>
        Nouveau mandat de gestion
      </h1>
      <p style={{ fontSize: 12, color: C.text3, marginTop: 6, marginBottom: 24 }}>
        §2.4.16 : les pourcentages de commission sont stockés comme donnée
        contractuelle pour le PDF mandat. <strong>Aucun prélèvement
        automatique</strong> n'est effectué par Althy.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <Field label="ID du mandant (propriétaire — user.id role=proprio_solo)">
          <input type="text" value={mandantId} onChange={(e) => setMandantId(e.target.value)} required style={inputStyle} />
        </Field>
        <Field label="ID de l'agence (user.id role=agence)">
          <input type="text" value={agenceId} onChange={(e) => setAgenceId(e.target.value)} required style={inputStyle} />
        </Field>
        <Field label="ID du bien (optionnel — vide = mandat global tous biens du mandant)">
          <input type="text" value={bienId} onChange={(e) => setBienId(e.target.value)} placeholder="bien.id" style={inputStyle} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Commission année (%)">
            <input type="number" step="0.01" min={0} max={100} value={commissionAnnee} onChange={(e) => setCommissionAnnee(parseFloat(e.target.value))} style={inputStyle} />
          </Field>
          <Field label="Commission saison (%)">
            <input type="number" step="0.01" min={0} max={100} value={commissionSaison} onChange={(e) => setCommissionSaison(parseFloat(e.target.value))} style={inputStyle} />
          </Field>
          <Field label="Commission semaine (%)">
            <input type="number" step="0.01" min={0} max={100} value={commissionSemaine} onChange={(e) => setCommissionSemaine(parseFloat(e.target.value))} style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Date de début">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required style={inputStyle} />
          </Field>
          <Field label="Date de fin (vide = durée indéterminée)">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Préavis (mois)">
            <input type="number" min={0} max={24} value={noticePeriodMonths} onChange={(e) => setNoticePeriodMonths(parseInt(e.target.value) || 0)} style={inputStyle} />
          </Field>
          <Field label="Échéance annuelle (mm-jj — ex: 10-01)">
            <input type="text" placeholder="10-01" value={noticeDeadlineMonthDay} onChange={(e) => setNoticeDeadlineMonthDay(e.target.value)} pattern="[0-9]{2}-[0-9]{2}" style={inputStyle} />
          </Field>
        </div>

        <Field label="For juridique">
          <input type="text" value={forJuridique} onChange={(e) => setForJuridique(e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Notes complémentaires (optionnel)">
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />
        </Field>

        {mutation.isError && (
          <p style={{ color: "#991B1B", fontSize: 13 }}>
            Erreur : vérifiez que mandant_id pointe un proprio_solo, agence_id pointe un user role=agence, et qu'ils sont distincts.
          </p>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => router.back()} style={{ padding: "10px 18px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.text2, fontSize: 13, fontWeight: 600 }}>
            Annuler
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !mandantId || !agenceId}
            style={{ padding: "10px 24px", borderRadius: 8, border: "none", background: C.prussian, color: "#fff", fontSize: 14, fontWeight: 700, opacity: mutation.isPending || !mandantId || !agenceId ? 0.5 : 1, cursor: mutation.isPending ? "not-allowed" : "pointer" }}
          >
            {mutation.isPending ? "Création…" : "Créer le mandat (brouillon)"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, color: C.text, boxSizing: "border-box" };
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: "block", fontSize: 12, color: C.text2, fontWeight: 600, marginBottom: 6 }}>{label}</label>{children}</div>; }
