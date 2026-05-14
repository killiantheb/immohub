"use client";

import { useParams, useRouter } from "next/navigation";
import { Loader2, Send, Download, ArrowLeft, AlertTriangle, Mail, CheckCircle2 } from "lucide-react";
import {
  useResiliation,
  useSendResiliationToSkribble,
  useMarquerEnvoyee,
  useMarquerAppliquee,
  useSkribbleStatus,
} from "@/lib/hooks/useSprint10";
import { C } from "@/lib/design-tokens";

const INITIATEUR_LABELS: Record<string, string> = {
  locataire: "Locataire",
  bailleur: "Bailleur",
  agence_mandataire: "Agence-mandataire",
};

export default function ResiliationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: r, isLoading } = useResiliation(id);
  const send = useSendResiliationToSkribble();
  const envoyer = useMarquerEnvoyee();
  const appliquer = useMarquerAppliquee();
  const { data: skStatus } = useSkribbleStatus("resiliation", id, Boolean(r?.skribble_session_id));

  if (isLoading || !r) {
    return <div style={{ padding: "48px 0", textAlign: "center" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: C.prussian, margin: "0 auto" }} /></div>;
  }

  const status = skStatus?.skribble_status ?? r.skribble_status ?? r.status;
  const isHabitation = r.initiateur === "bailleur";

  return (
    <div style={{ padding: "24px 0", maxWidth: 800 }}>
      <button onClick={() => router.back()} style={{ background: "none", border: "none", color: C.text3, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <p style={{ fontSize: 11, color: C.text3, letterSpacing: "0.08em", textTransform: "uppercase" }}>Résiliation · {r.reference}</p>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 400, color: C.text, margin: "4px 0 16px 0" }}>
        Initiée par {INITIATEUR_LABELS[r.initiateur]} · effective {r.date_resiliation}
      </h1>

      <span style={{ display: "inline-block", padding: "5px 12px", background: status === "appliquee" || status === "completed" ? "#0F2E4C" : "#C9A961", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {String(status)}
      </span>

      {r.warning_co_266l && (
        <div style={{ marginTop: 16, padding: "14px 18px", background: "#FFF6E5", borderLeft: "3px solid #C9A961", borderRadius: 4, display: "flex", gap: 10, color: "#7A6428", fontSize: 13, lineHeight: 1.5 }}>
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{r.warning_message}</span>
        </div>
      )}

      <section style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginTop: 16 }}>
        <Row label="Bail associé" value={<a href={`/app/contracts/${r.contract_id}`} style={{ color: C.gold }}>#{r.contract_id.slice(0, 8)}</a>} />
        <Row label="Date d'envoi" value={r.date_envoi} />
        <Row label="Date effective" value={r.date_resiliation} />
        <Row label="Préavis" value={`${r.preavis_months} mois — ${r.respect_preavis ? "respecté (ordinaire)" : "extraordinaire"}`} />
        {r.motif && <Row label="Motif" value={r.motif} />}
        {r.signed_at && <Row label="Signée le" value={new Date(r.signed_at).toLocaleString("fr-CH")} />}
        {r.notification_envoyee_at && <Row label="Courrier envoyé" value={new Date(r.notification_envoyee_at).toLocaleString("fr-CH")} />}
      </section>

      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <a href={`/api/v1/resiliations/${r.id}/pdf`} target="_blank" rel="noreferrer" style={btnSecondary}>
          <Download className="h-4 w-4" /> {r.skribble_signed_pdf_url ? "PDF signé" : "PDF draft"}
        </a>

        {r.status === "draft" && (
          <button onClick={() => send.mutate(r.id)} disabled={send.isPending} style={btnPrimary}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer en signature Skribble
          </button>
        )}

        {r.status === "signed" && !r.notification_envoyee_at && (
          <button onClick={() => envoyer.mutate(r.id)} disabled={envoyer.isPending} style={btnPrimary}>
            <Mail className="h-4 w-4" />
            Marquer courrier envoyé
          </button>
        )}

        {(r.status === "signed" || r.status === "envoyee") && (
          <button onClick={() => appliquer.mutate(r.id)} disabled={appliquer.isPending} style={btnPrimary}>
            <CheckCircle2 className="h-4 w-4" />
            Marquer appliquée (bail → terminated)
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, padding: "6px 0", borderBottom: `1px solid #F0EBE0`, fontSize: 14 }}>
      <span style={{ color: C.text3 }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: C.prussian, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "transparent", color: C.text2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", textDecoration: "none" };
