"use client";

/**
 * Détail avenant — Sprint 10 Lot 6.
 *
 * Affiche metadata + corps + actions selon status :
 *   - draft → bouton "Envoyer en signature Skribble"
 *   - pending_signatures → polling Skribble + bouton "Annuler la signature"
 *   - signed → bouton "Télécharger le PDF signé"
 */

import { useParams, useRouter } from "next/navigation";
import { Loader2, Send, X, Download, FileSignature, ArrowLeft } from "lucide-react";
import {
  useAvenant,
  useSendAvenantToSkribble,
  useSkribbleStatus,
  useSkribbleCancel,
} from "@/lib/hooks/useSprint10";
import { C } from "@/lib/design-tokens";

const AVENANT_TYPE_LABELS: Record<string, string> = {
  animaux: "Autorisation d'animaux",
  modification_loyer: "Modification du loyer",
  modification_date: "Modification de la date",
  prolongation: "Prolongation du bail",
  resiliation_anticipee: "Résiliation anticipée",
  changement_proprietaire: "Changement de propriétaire",
  changement_locataire: "Changement de locataire",
  charge_electrique: "Charge électrique",
  accord_specifique: "Accord spécifique",
};

export default function AvenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const { data: avenant, isLoading } = useAvenant(id);
  const sendMutation = useSendAvenantToSkribble();
  const cancelMutation = useSkribbleCancel();
  const { data: skribbleStatus } = useSkribbleStatus(
    "avenant",
    id,
    Boolean(avenant?.skribble_session_id),
  );

  if (isLoading || !avenant) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: C.prussian, margin: "0 auto" }} />
      </div>
    );
  }

  const typeLabel = AVENANT_TYPE_LABELS[avenant.avenant_type] ?? avenant.avenant_type;
  const isDraft = avenant.status === "draft";
  const isPending =
    avenant.skribble_status === "pending_signatures" ||
    avenant.skribble_status === "partial_signed" ||
    skribbleStatus?.skribble_status === "pending_signatures" ||
    skribbleStatus?.skribble_status === "partial_signed";
  const isSigned = avenant.status === "signed" || avenant.skribble_status === "completed";

  return (
    <div style={{ padding: "24px 0", maxWidth: 800 }}>
      <button
        onClick={() => router.back()}
        style={{ background: "none", border: "none", color: C.text3, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>

      <header>
        <p style={{ fontSize: 11, color: C.text3, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Avenant · {avenant.reference}
        </p>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 400, color: C.text, margin: "4px 0 16px 0" }}>
          {typeLabel}
        </h1>
        <StatusBadge status={avenant.status} skribbleStatus={skribbleStatus?.skribble_status ?? avenant.skribble_status} />
      </header>

      <Card>
        <Row label="Objet" value={avenant.objet} />
        {avenant.effective_date && <Row label="Date d'effet" value={avenant.effective_date} />}
        {avenant.body_text && <Row label="Corps libre" value={avenant.body_text} />}
        <Row label="Bail associé" value={
          <a href={`/app/contracts/${avenant.contract_id}`} style={{ color: C.gold, textDecoration: "none" }}>
            #{avenant.contract_id.slice(0, 8)}
          </a>
        } />
      </Card>

      {Object.keys(avenant.data).length > 0 && (
        <Card title="Données structurées (avenant.data)">
          <pre style={{ fontSize: 12, color: C.text2, background: "#F8F6F0", padding: 12, borderRadius: 6, overflow: "auto" }}>
            {JSON.stringify(avenant.data, null, 2)}
          </pre>
        </Card>
      )}

      <Card title="Signatures">
        <Row
          label="Locataire"
          value={avenant.signed_at_locataire ? `Signé le ${new Date(avenant.signed_at_locataire).toLocaleString("fr-CH")}` : "En attente"}
        />
        <Row
          label="Agence-mandataire"
          value={avenant.signed_at_agence ? `Signé le ${new Date(avenant.signed_at_agence).toLocaleString("fr-CH")}` : "En attente"}
        />
        {avenant.skribble_session_id && (
          <Row label="Session Skribble" value={<code style={{ fontSize: 11 }}>{avenant.skribble_session_id}</code>} />
        )}
      </Card>

      <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
        <a
          href={`/api/v1/avenants/${avenant.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          style={btnSecondary}
        >
          <Download className="h-4 w-4" />
          {isSigned && avenant.skribble_signed_pdf_url ? "Télécharger PDF signé" : "Aperçu PDF draft"}
        </a>

        {isDraft && (
          <button
            onClick={() => sendMutation.mutate(avenant.id)}
            disabled={sendMutation.isPending}
            style={btnPrimary}
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer en signature Skribble
          </button>
        )}

        {isPending && (
          <button
            onClick={() => cancelMutation.mutate({ docType: "avenant", docId: avenant.id })}
            disabled={cancelMutation.isPending}
            style={btnDanger}
          >
            <X className="h-4 w-4" />
            Annuler la signature
          </button>
        )}
      </div>

      {sendMutation.isError && (
        <p style={{ color: "#991B1B", fontSize: 13, marginTop: 12 }}>
          {(sendMutation.error as any)?.response?.data?.detail ?? "Erreur envoi Skribble."}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status, skribbleStatus }: { status: string; skribbleStatus: string | null }) {
  const effective = skribbleStatus ?? status;
  const colors: Record<string, string> = {
    draft: "#6E7682",
    pending_signatures: "#C9A961",
    partial_signed: "#C9A961",
    signed: "#0F2E4C",
    completed: "#0F2E4C",
    declined: "#991B1B",
    expired: "#991B1B",
    terminated: "#6E7682",
    cancelled: "#6E7682",
  };
  return (
    <span style={{ display: "inline-block", padding: "5px 12px", background: colors[effective] ?? "#6E7682", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {effective}
    </span>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginTop: 16 }}>
      {title && <h2 style={{ fontSize: 13, fontWeight: 700, color: C.text2, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px 0" }}>{title}</h2>}
      {children}
    </section>
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

const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 18px",
  background: C.prussian,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
};

const btnSecondary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 18px",
  background: "transparent",
  color: C.text2,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
};

const btnDanger: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 18px",
  background: "transparent",
  color: "#991B1B",
  border: `1px solid #FCA5A5`,
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
