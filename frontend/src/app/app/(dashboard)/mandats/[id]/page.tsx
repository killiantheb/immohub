"use client";

import { useParams, useRouter } from "next/navigation";
import { Loader2, Send, Download, ArrowLeft, XCircle } from "lucide-react";
import {
  useMandat,
  useSendMandatToSkribble,
  useTerminerMandat,
  useSkribbleStatus,
} from "@/lib/hooks/useSprint10";
import { C } from "@/lib/design-tokens";

export default function MandatDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: m, isLoading } = useMandat(id);
  const send = useSendMandatToSkribble();
  const terminer = useTerminerMandat();
  const { data: skStatus } = useSkribbleStatus("mandat", id, Boolean(m?.skribble_session_id));

  if (isLoading || !m) {
    return <div style={{ padding: "48px 0", textAlign: "center" }}><Loader2 className="h-8 w-8 animate-spin" style={{ color: C.prussian, margin: "0 auto" }} /></div>;
  }

  const status = skStatus?.skribble_status ?? m.skribble_status ?? m.status;

  return (
    <div style={{ padding: "24px 0", maxWidth: 800 }}>
      <button onClick={() => router.back()} style={{ background: "none", border: "none", color: C.text3, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <p style={{ fontSize: 11, color: C.text3, letterSpacing: "0.08em", textTransform: "uppercase" }}>Mandat · {m.reference}</p>
      <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 400, color: C.text, margin: "4px 0 16px 0" }}>
        Mandat de gestion locative
      </h1>

      <span style={{ display: "inline-block", padding: "5px 12px", background: m.status === "active" || status === "completed" ? "#0F2E4C" : "#C9A961", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {String(status)}
      </span>

      <section style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginTop: 16 }}>
        <Row label="Mandant (propriétaire)" value={<code>#{m.mandant_id.slice(0, 8)}</code>} />
        <Row label="Agence" value={<code>#{m.agence_id.slice(0, 8)}</code>} />
        {m.bien_id && <Row label="Bien spécifique" value={<a href={`/app/biens/${m.bien_id}`} style={{ color: C.gold }}>#{m.bien_id.slice(0, 8)}</a>} />}
        {!m.bien_id && <Row label="Périmètre" value="Mandat global (tous biens du mandant)" />}
        <Row label="Période" value={`${m.start_date} → ${m.end_date ?? "indéterminée"}`} />
        <Row label="Préavis" value={`${m.notice_period_months} mois${m.notice_deadline_month_day ? ` (échéance annuelle ${m.notice_deadline_month_day})` : ""}`} />
        <Row label="For juridique" value={m.for_juridique} />
      </section>

      <section style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginTop: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text2, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px 0" }}>
          Commissions (data contractuelle — pas de prélèvement automatique)
        </h2>
        <Row label="Location annuelle" value={`${Number(m.commission_pct_annee)}% HT + TVA`} />
        <Row label="Location saison" value={`${Number(m.commission_pct_saison)}% HT + TVA`} />
        <Row label="Location semaine" value={`${Number(m.commission_pct_semaine)}% HT + TVA`} />
      </section>

      <section style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginTop: 16 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text2, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px 0" }}>
          Signatures
        </h2>
        <Row label="Mandant" value={m.signed_at_mandant ? `Signé le ${new Date(m.signed_at_mandant).toLocaleString("fr-CH")}` : "En attente"} />
        <Row label="Agence" value={m.signed_at_agence ? `Signé le ${new Date(m.signed_at_agence).toLocaleString("fr-CH")}` : "En attente"} />
        {m.skribble_session_id && <Row label="Session Skribble" value={<code style={{ fontSize: 11 }}>{m.skribble_session_id}</code>} />}
      </section>

      {m.notes && (
        <section style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginTop: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text2, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px 0" }}>Notes</h2>
          <p style={{ fontSize: 14, color: C.text, whiteSpace: "pre-wrap" }}>{m.notes}</p>
        </section>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <a href={`/api/v1/mandats/${m.id}/pdf`} target="_blank" rel="noreferrer" style={btnSecondary}>
          <Download className="h-4 w-4" /> {m.skribble_signed_pdf_url ? "PDF signé" : "PDF draft"}
        </a>

        {m.status === "draft" && (
          <button onClick={() => send.mutate(m.id)} disabled={send.isPending} style={btnPrimary}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer en signature Skribble (mandant + agence)
          </button>
        )}

        {m.status === "active" && (
          <button onClick={() => terminer.mutate(m.id)} disabled={terminer.isPending} style={btnDanger}>
            <XCircle className="h-4 w-4" /> Résilier le mandat
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, padding: "6px 0", borderBottom: `1px solid #F0EBE0`, fontSize: 14 }}>
      <span style={{ color: C.text3 }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: C.prussian, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const btnSecondary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "transparent", color: C.text2, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", textDecoration: "none" };
const btnDanger: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "transparent", color: "#991B1B", border: "1px solid #FCA5A5", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" };
