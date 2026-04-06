"use client";

import { useState } from "react";
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

// ── Labels ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ContractType, string> = {
  long_term: "Longue durée",
  seasonal: "Saisonnier",
  short_term: "Courte durée",
  sale: "Vente",
};

const STATUS_CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  draft:      { label: "Brouillon",  className: "bg-gray-100 text-gray-600" },
  active:     { label: "Actif",      className: "bg-green-100 text-green-700" },
  terminated: { label: "Résilié",    className: "bg-orange-100 text-orange-700" },
  expired:    { label: "Expiré",     className: "bg-red-100 text-red-600" },
};

function ContractStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as ContractStatus] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContractsPage() {
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

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contrats</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {data ? `${data.total} contrat${data.total !== 1 ? "s" : ""}` : "Gérez vos contrats"}
          </p>
        </div>
        <Link href="/contracts/new" className="btn-primary flex items-center gap-2">
          <FilePlus className="h-4 w-4" />
          Nouveau contrat
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Référence…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input w-auto"
          >
            <option value="">Tous les statuts</option>
            {(Object.entries(STATUS_CONFIG) as [ContractStatus, { label: string }][]).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>
          {(statusFilter || search) && (
            <button onClick={() => { setStatusFilter(""); setSearch(""); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
              <X className="h-4 w-4" /> Effacer
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="card py-16 text-center text-gray-500">Erreur lors du chargement</div>
      ) : !filtered.length ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <p className="text-gray-500">Aucun contrat trouvé</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {["Référence", "Type", "Bien", "Début", "Fin", "Loyer", "Statut", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((contract) => (
                  <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-primary-600">
                      <Link href={`/contracts/${contract.id}`} className="hover:underline">
                        {contract.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {TYPE_LABELS[contract.type as ContractType] ?? contract.type}
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                      {contract.property_id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(contract.start_date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {contract.end_date ? new Date(contract.end_date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {contract.monthly_rent != null
                        ? `${contract.monthly_rent.toLocaleString("fr-FR")} €`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ContractStatusBadge status={contract.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* Sign */}
                        {!contract.signed_at && contract.status !== "terminated" && (
                          <SignButton contractId={contract.id} />
                        )}
                        {contract.signed_at && (
                          <span title={`Signé le ${new Date(contract.signed_at).toLocaleDateString("fr-FR")}`}>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </span>
                        )}
                        {/* PDF */}
                        <a
                          href={`${process.env.NEXT_PUBLIC_API_URL}/contracts/${contract.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-gray-400 hover:text-gray-700"
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

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary flex items-center gap-1 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" /> Précédent
              </button>
              <span className="text-sm text-gray-600">Page {page} / {data.pages}</span>
              <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages} className="btn-secondary flex items-center gap-1 disabled:opacity-40">
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
      className="text-gray-400 hover:text-primary-600 disabled:opacity-50"
    >
      <PenLine className="h-4 w-4" />
    </button>
  );
}
