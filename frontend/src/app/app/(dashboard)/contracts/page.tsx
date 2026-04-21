"use client";

import { useState } from "react";
import { baseURL } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FilePlus,
  PenLine,
  Search,
  X,
} from "lucide-react";
import { useContracts, useDeleteContract, useSignContract } from "@/lib/hooks/useContracts";
import type { ContractStatus, ContractType } from "@/lib/types";
import { C } from "@/lib/design-tokens";
import { ComingSoon } from "@/components/ComingSoon";
import { FLAGS } from "@/lib/flags";


// ── Labels ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ContractType, string> = {
  long_term: "Longue durée",
  seasonal: "Saisonnier",
  short_term: "Courte durée",
  sale: "Vente",
};

const STATUS_CONFIG: Record<ContractStatus, { label: string; bg: string; color: string }> = {
  draft:      { label: "Brouillon",  bg: C.surface2,  color: C.text3 },
  active:     { label: "Actif",      bg: C.greenBg,   color: C.green },
  terminated: { label: "Résilié",    bg: C.orangeBg,  color: C.orange },
  expired:    { label: "Expiré",     bg: C.redBg,     color: C.red },
};

function ContractStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as ContractStatus] ?? { label: status, bg: C.surface2, color: C.text3 };
  return (
    <span style={{
      display: "inline-block",
      borderRadius: 999,
      padding: "2px 10px",
      fontSize: 11,
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  if (!FLAGS.ROLE_AGENCE) {
    return <ComingSoon title="Module Contrats en préparation" phase="Phase 2" />;
  }
  return <ContractsPageInner />;
}

function ContractsPageInner() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useContracts({
    status: statusFilter || undefined,
    page,
    size: 20,
  });

  const deleteContract = useDeleteContract();

  const filtered = data?.items.filter((c) =>
    !search || c.reference.toLowerCase().includes(search.toLowerCase()),
  ) ?? [];

  const inputStyle: React.CSSProperties = {
    padding: "9px 14px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.text,
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
  };

  const btnSecondaryStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "9px 16px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.text2,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, color: C.text, marginBottom: 2 }}>
            Contrats
          </h1>
          <p style={{ fontSize: 14, color: C.text3 }}>
            {data ? `${data.total} contrat${data.total !== 1 ? "s" : ""}` : "Gérez vos contrats"}
          </p>
        </div>
        <Link
          href="/app/contracts/new"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.orange, color: "#fff", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          <FilePlus className="h-4 w-4" />
          Nouveau contrat
        </Link>
      </div>

      {/* Filters */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow, padding: "1.25rem", marginBottom: "1.5rem" }}>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.text3 }} className="h-4 w-4" />
            <input
              type="search"
              placeholder="Référence…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36 }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{ ...inputStyle, width: "auto" }}
          >
            <option value="">Tous les statuts</option>
            {(Object.entries(STATUS_CONFIG) as [ContractStatus, { label: string }][]).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>
          {(statusFilter || search) && (
            <button
              onClick={() => { setStatusFilter(""); setSearch(""); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: C.text3, background: "transparent", border: "none", cursor: "pointer", padding: "4px 8px" }}
            >
              <X className="h-4 w-4" /> Effacer
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: `4px solid ${C.orange}`, borderTopColor: "transparent" }} className="animate-spin" />
        </div>
      ) : isError ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow, padding: "4rem 1.25rem", textAlign: "center", color: C.text3 }}>
          Erreur lors du chargement
        </div>
      ) : !filtered.length ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow, padding: "4rem 1.25rem", textAlign: "center", color: C.text3 }}>
          Aucun contrat trouvé
        </div>
      ) : (
        <>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, boxShadow: C.shadow, overflow: "hidden" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
                  <tr>
                    {["Référence", "Type", "Bien", "Début", "Fin", "Loyer", "Statut", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.text3 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((contract, idx) => (
                    <tr key={contract.id} style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : undefined }}>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: C.orange }}>
                        <Link href={`/app/contracts/${contract.id}`} style={{ color: C.orange, textDecoration: "none" }}>
                          {contract.reference}
                        </Link>
                      </td>
                      <td style={{ padding: "12px 16px", color: C.text }}>
                        {TYPE_LABELS[contract.type as ContractType] ?? contract.type}
                      </td>
                      <td style={{ padding: "12px 16px", color: C.text3, fontFamily: "monospace", fontSize: 11 }}>
                        {contract.property_id.slice(0, 8)}…
                      </td>
                      <td style={{ padding: "12px 16px", color: C.text2 }}>
                        {new Date(contract.start_date).toLocaleDateString("fr-FR")}
                      </td>
                      <td style={{ padding: "12px 16px", color: C.text2 }}>
                        {contract.end_date ? new Date(contract.end_date).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: C.text }}>
                        {contract.monthly_rent != null
                          ? `${contract.monthly_rent.toLocaleString("fr-FR")} €`
                          : "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <ContractStatusBadge status={contract.status} />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div className="flex items-center gap-1.5">
                          {/* Sign */}
                          {!contract.signed_at && contract.status !== "terminated" && (
                            <SignButton contractId={contract.id} />
                          )}
                          {contract.signed_at && (
                            <span title={`Signé le ${new Date(contract.signed_at).toLocaleDateString("fr-FR")}`}>
                              <CheckCircle className="h-4 w-4" style={{ color: C.green }} />
                            </span>
                          )}
                          {/* PDF */}
                          <a
                            href={`${baseURL}/contracts/${contract.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: C.text3 }}
                            title="Télécharger PDF"
                          >
                            <FileDown className="h-4 w-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ ...btnSecondaryStyle, opacity: page === 1 ? 0.4 : 1 }}
              >
                <ChevronLeft className="h-4 w-4" /> Précédent
              </button>
              <span style={{ fontSize: 13, color: C.text2 }}>Page {page} / {data.pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                style={{ ...btnSecondaryStyle, opacity: page === data.pages ? 0.4 : 1 }}
              >
                Suivant <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sign button (isolated to avoid re-render cascade) ─────────────────────────

function SignButton({ contractId }: { contractId: string }) {
  const sign = useSignContract(contractId);
  return (
    <button
      onClick={() => sign.mutate()}
      disabled={sign.isPending}
      title="Signer"
      style={{ background: "transparent", border: "none", cursor: sign.isPending ? "not-allowed" : "pointer", color: C.text3, padding: 0, opacity: sign.isPending ? 0.5 : 1 }}
    >
      <PenLine className="h-4 w-4" />
    </button>
  );
}
