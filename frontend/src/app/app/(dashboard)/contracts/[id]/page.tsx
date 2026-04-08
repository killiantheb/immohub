"use client";

import { useEffect, useState } from "react";
import { baseURL } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  FileDown,
  PenLine,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  useContract,
  useDeleteContract,
  useSignContract,
  useUpdateContract,
} from "@/lib/hooks/useContracts";
import type { ContractStatus, ContractType } from "@/lib/types";
import { NotificationDraft } from "@/components/NotificationDraft";
import { DocumentQuickGenerator } from "@/components/DocumentQuickGenerator";

const S = {
  bg: "var(--althy-bg)",
  surface: "var(--althy-surface)",
  surface2: "var(--althy-surface-2)",
  border: "var(--althy-border)",
  text: "var(--althy-text)",
  text2: "var(--althy-text-2)",
  text3: "var(--althy-text-3)",
  orange: "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg)",
  green: "var(--althy-green)",
  greenBg: "var(--althy-green-bg)",
  red: "var(--althy-red)",
  redBg: "var(--althy-red-bg)",
  amber: "var(--althy-amber)",
  amberBg: "var(--althy-amber-bg)",
  blue: "var(--althy-blue)",
  blueBg: "var(--althy-blue-bg)",
  shadow: "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

const CONTRACT_TYPE_TO_BAIL: Record<string, string> = {
  long_term:  "bail_annee",
  seasonal:   "bail_saison",
  short_term: "bail_saison",
  sale:       "bail_annee_avec_vente",
};

const TYPE_LABELS: Record<ContractType, string> = {
  long_term:  "Longue durée",
  seasonal:   "Saisonnier",
  short_term: "Courte durée",
  sale:       "Vente",
};

const STATUS_CONFIG: Record<ContractStatus, { label: string; bg: string; color: string }> = {
  draft:      { label: "Brouillon", bg: S.surface2,  color: S.text3 },
  active:     { label: "Actif",     bg: S.greenBg,   color: S.green },
  terminated: { label: "Résilié",   bg: S.orangeBg,  color: S.orange },
  expired:    { label: "Expiré",    bg: S.redBg,     color: S.red },
};

const cardStyle: React.CSSProperties = {
  background: S.surface,
  border: `1px solid ${S.border}`,
  borderRadius: 14,
  boxShadow: S.shadow,
  padding: "1.25rem",
};

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "7px 12px",
  borderRadius: 8,
  border: `1px solid ${S.border}`,
  background: S.surface,
  color: S.text,
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const btnSecondaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 10,
  border: `1px solid ${S.border}`,
  background: S.surface,
  color: S.text2,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnPrimaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: 10,
  border: "none",
  background: S.orange,
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

function fmt(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR");
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: contract, isLoading, isError } = useContract(id);
  const update = useUpdateContract(id);
  const deleteContract = useDeleteContract();
  const sign = useSignContract(id);

  const [editing, setEditing] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [form, setForm] = useState({
    monthly_rent: "",
    charges: "",
    deposit: "",
    end_date: "",
    status: "" as ContractStatus | "",
  });

  useEffect(() => {
    if (contract) {
      setForm({
        monthly_rent: contract.monthly_rent?.toString() ?? "",
        charges: contract.charges?.toString() ?? "",
        deposit: contract.deposit?.toString() ?? "",
        end_date: contract.end_date ? contract.end_date.slice(0, 10) : "",
        status: contract.status as ContractStatus,
      });
    }
  }, [contract]);

  async function handleSave() {
    await update.mutateAsync({
      monthly_rent: form.monthly_rent ? parseFloat(form.monthly_rent) : undefined,
      charges: form.charges ? parseFloat(form.charges) : undefined,
      deposit: form.deposit ? parseFloat(form.deposit) : undefined,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : undefined,
      status: (form.status || undefined) as ContractStatus | undefined,
    });
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm("Supprimer ce contrat ?")) return;
    await deleteContract.mutateAsync(id);
    router.push("/app/contracts");
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: `4px solid ${S.orange}`, borderTopColor: "transparent" }} className="animate-spin" />
      </div>
    );
  }

  if (isError || !contract) {
    return (
      <div style={{ ...cardStyle, padding: "5rem 1.25rem", textAlign: "center", color: S.text3 }}>
        Contrat introuvable.{" "}
        <Link href="/app/contracts" style={{ color: S.orange, textDecoration: "underline" }}>Retour</Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[contract.status as ContractStatus] ?? { label: contract.status, bg: S.surface2, color: S.text3 };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {showNotif && (
        <NotificationDraft
          recipientName="Locataire"
          context={`Contrat ${contract.reference} — loyer ${contract.monthly_rent ? contract.monthly_rent + ' CHF/mois' : ''} — statut : ${statusCfg.label}`}
          onClose={() => setShowNotif(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/app/contracts" style={{ color: S.text3, display: "flex", alignItems: "center" }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontWeight: 400, fontSize: 28, color: S.text }}>
            {contract.reference}
          </h1>
          <p style={{ fontSize: 14, color: S.text3 }}>
            {TYPE_LABELS[contract.type as ContractType] ?? contract.type}
          </p>
        </div>
        <span style={{ borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 600, background: statusCfg.bg, color: statusCfg.color }}>
          {statusCfg.label}
        </span>
        <div className="flex gap-2 flex-wrap">
          {!editing ? (
            <>
              <DocumentQuickGenerator
                label="Générer le bail"
                icon="bail"
                templateType={CONTRACT_TYPE_TO_BAIL[contract.type] ?? "bail_annee"}
                contractId={id}
                variant="primary"
              />
              <DocumentQuickGenerator
                label="Demande de pièces"
                icon="pieces"
                contractId={id}
                smartPieces
                variant="outline"
              />
              <DocumentQuickGenerator
                label="Quittance"
                icon="quittance"
                contractId={id}
                quittanceMode
                variant="outline"
              />
              <button onClick={() => setShowNotif(true)} style={btnSecondaryStyle}>
                Notifier
              </button>
              <button onClick={() => setEditing(true)} style={btnSecondaryStyle}>
                <PenLine className="h-4 w-4" /> Modifier
              </button>
              <a
                href={`${baseURL}/contracts/${id}/pdf`}
                target="_blank"
                rel="noreferrer"
                style={{ ...btnSecondaryStyle, textDecoration: "none" }}
              >
                <FileDown className="h-4 w-4" /> PDF
              </a>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={update.isPending}
                style={{ ...btnPrimaryStyle, opacity: update.isPending ? 0.7 : 1 }}
              >
                <Save className="h-4 w-4" />
                {update.isPending ? "Sauvegarde…" : "Sauvegarder"}
              </button>
              <button onClick={() => setEditing(false)} style={btnSecondaryStyle}>
                <X className="h-4 w-4" /> Annuler
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Parties */}
        <div style={cardStyle} className="space-y-3">
          <h2 style={{ fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: "0.5rem" }}>Parties</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt style={{ color: S.text3 }}>Bien</dt>
              <dd style={{ fontFamily: "monospace", fontSize: 11, color: S.orange }}>{contract.property_id.slice(0, 8)}…</dd>
            </div>
            <div className="flex justify-between">
              <dt style={{ color: S.text3 }}>Propriétaire</dt>
              <dd style={{ fontFamily: "monospace", fontSize: 11, color: S.text }}>{contract.owner_id.slice(0, 8)}…</dd>
            </div>
            {contract.tenant_id && (
              <div className="flex justify-between">
                <dt style={{ color: S.text3 }}>Locataire</dt>
                <dd style={{ fontFamily: "monospace", fontSize: 11, color: S.text }}>{contract.tenant_id.slice(0, 8)}…</dd>
              </div>
            )}
            {contract.agency_id && (
              <div className="flex justify-between">
                <dt style={{ color: S.text3 }}>Agence</dt>
                <dd style={{ fontFamily: "monospace", fontSize: 11, color: S.text }}>{contract.agency_id.slice(0, 8)}…</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Dates */}
        <div style={cardStyle} className="space-y-3">
          <h2 style={{ fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: "0.5rem" }}>Durée</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt style={{ color: S.text3 }}>Début</dt>
              <dd style={{ color: S.text }}>{fmt(contract.start_date)}</dd>
            </div>
            <div className="flex justify-between items-center">
              <dt style={{ color: S.text3 }}>Fin</dt>
              {editing ? (
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  style={{ ...inputStyle, width: 144 }}
                />
              ) : (
                <dd style={{ color: S.text }}>{fmt(contract.end_date)}</dd>
              )}
            </div>
            {contract.signed_at && (
              <div className="flex justify-between">
                <dt style={{ color: S.text3 }}>Signé le</dt>
                <dd style={{ display: "flex", alignItems: "center", gap: 4, color: S.green }}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  {fmt(contract.signed_at)}
                </dd>
              </div>
            )}
            {editing && (
              <div className="flex justify-between items-center">
                <dt style={{ color: S.text3 }}>Statut</dt>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ContractStatus }))}
                  style={{ ...inputStyle, width: 160 }}
                >
                  {(Object.entries(STATUS_CONFIG) as [ContractStatus, { label: string }][]).map(([v, c]) => (
                    <option key={v} value={v}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}
          </dl>
        </div>

        {/* Finances */}
        <div style={{ ...cardStyle, gridColumn: "1 / -1" }} className="space-y-3">
          <h2 style={{ fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: "0.5rem" }}>Finances</h2>
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: "Loyer mensuel", field: "monthly_rent" as const, value: contract.monthly_rent },
              { label: "Charges",       field: "charges" as const,      value: contract.charges },
              { label: "Dépôt de garantie", field: "deposit" as const,  value: contract.deposit },
            ].map(({ label, field, value }) => (
              <div key={field}>
                <p style={{ fontSize: 12, color: S.text3, marginBottom: 4 }}>{label}</p>
                {editing ? (
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    style={inputStyle}
                  />
                ) : (
                  <p style={{ fontSize: 20, fontWeight: 700, color: S.text }}>
                    {value != null ? `CHF ${value.toLocaleString("fr-CH")}` : "—"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signature */}
      {!contract.signed_at && contract.status !== "terminated" && (
        <div style={cardStyle}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: S.text2, marginBottom: "0.75rem" }}>Signature électronique</h2>
          <p style={{ fontSize: 13, color: S.text3, marginBottom: "1rem" }}>
            La signature enregistre votre adresse IP et l&apos;horodatage comme preuve de consentement.
          </p>
          <button
            onClick={() => sign.mutate()}
            disabled={sign.isPending}
            style={{ ...btnPrimaryStyle, opacity: sign.isPending ? 0.7 : 1 }}
          >
            <PenLine className="h-4 w-4" />
            {sign.isPending ? "Signature…" : "Signer le contrat"}
          </button>
        </div>
      )}

      {/* Danger zone */}
      <div style={{ borderRadius: 14, border: `1px solid ${S.red}`, background: S.redBg, padding: "1.5rem", opacity: 0.85 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: S.red, marginBottom: 4 }}>Zone de danger</h2>
        <p style={{ fontSize: 13, color: S.text3, marginBottom: "1rem" }}>La suppression est irréversible.</p>
        <button
          onClick={handleDelete}
          disabled={deleteContract.isPending}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 10, border: `1px solid ${S.red}`, background: S.surface, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: S.red, cursor: deleteContract.isPending ? "not-allowed" : "pointer", opacity: deleteContract.isPending ? 0.5 : 1 }}
        >
          <Trash2 className="h-4 w-4" />
          {deleteContract.isPending ? "Suppression…" : "Supprimer le contrat"}
        </button>
      </div>
    </div>
  );
}
