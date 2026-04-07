"use client";

import { Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { baseURL } from "@/lib/api";
import { useGenerateMonthlyRents, useMarkPaid, useTransactions } from "@/lib/hooks/useTransactions";
import { useRevenueStats } from "@/lib/hooks/useTransactions";
import { RentStatusBadge } from "@/components/RentStatusBadge";
import { RevenueChart } from "@/components/RevenueChart";
import type { TransactionStatus, TransactionType } from "@/lib/types";

// ── Labels ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<TransactionType, string> = {
  rent: "Loyer",
  commission: "Commission",
  deposit: "Dépôt",
  service: "Service",
  quote: "Devis",
};

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(rows: import("@/lib/types").Transaction[]) {
  const headers = ["Référence", "Type", "Statut", "Montant (€)", "Échéance", "Payé le", "Notes"];
  const lines = rows.map((t) => [
    t.reference,
    TYPE_LABELS[t.type as TransactionType] ?? t.type,
    t.status,
    t.amount.toFixed(2) + " CHF",
    t.due_date ? new Date(t.due_date).toLocaleDateString("fr-FR") : "",
    t.paid_at ? new Date(t.paid_at).toLocaleDateString("fr-FR") : "",
    t.notes ?? "",
  ]);
  const csv = [headers, ...lines].map((r) => r.map((v) => `"${v}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsContent />
    </Suspense>
  );
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [typeFilter, setTypeFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showChart, setShowChart] = useState(false);

  const { data, isLoading, isError } = useTransactions({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    month: monthFilter || undefined,
    page,
    size: 25,
  });

  const { data: stats } = useRevenueStats(12);
  const markPaid = useMarkPaid();
  const generateRents = useGenerateMonthlyRents();

  const clearFilters = useCallback(() => {
    setStatusFilter(""); setTypeFilter(""); setMonthFilter(""); setSearch(""); setPage(1);
  }, []);

  const filtered = data?.items.filter((t) =>
    !search || t.reference.toLowerCase().includes(search.toLowerCase()) || (t.notes ?? "").toLowerCase().includes(search.toLowerCase()),
  ) ?? [];

  const hasFilters = statusFilter || typeFilter || monthFilter || search;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {data ? `${data.total} transaction${data.total !== 1 ? "s" : ""}` : "Historique financier"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowChart((v) => !v)}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            {showChart ? "Masquer graphique" : "Voir graphique"}
          </button>
          <button
            onClick={() => generateRents.mutate()}
            disabled={generateRents.isPending}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Générer les loyers du mois"
          >
            <RefreshCw className={`h-4 w-4 ${generateRents.isPending ? "animate-spin" : ""}`} />
            Générer loyers
          </button>
          {filtered.length > 0 && (
            <button
              onClick={() => exportCSV(filtered)}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          )}
          <button
            onClick={() => {
              const year = new Date().getFullYear();
              window.open(`${baseURL}/transactions/export-csv?year=${year}`, '_blank');
            }}
            className="btn-secondary flex items-center gap-2 text-sm"
            title="Export comptable avec catégories fiscales suisses"
          >
            <Download className="h-4 w-4" />
            Fiscal CH {new Date().getFullYear()}
          </button>
        </div>
      </div>

      {/* Revenue chart (collapsible) */}
      {showChart && stats && (
        <div className="card mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Revenus loyers — 12 mois</h2>
          <RevenueChart data={stats.by_month} height={180} />
          {/* Mini stats */}
          <div className="mt-3 flex flex-wrap gap-4 border-t pt-3 text-sm">
            {[
              { label: "Total encaissé", value: `CHF ${stats.total.toLocaleString("fr-CH")}`, color: "text-green-700" },
              { label: "En attente", value: stats.pending_count, color: "text-amber-700" },
              { label: "Impayés", value: stats.late_count, color: "text-red-600" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className="text-gray-400">{label}</p>
                <p className={`font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-5 card p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Référence, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input w-auto">
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="paid">Payé</option>
            <option value="late">Impayé</option>
            <option value="cancelled">Annulé</option>
          </select>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="input w-auto">
            <option value="">Tous les types</option>
            {(Object.entries(TYPE_LABELS) as [TransactionType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
            className="input w-auto"
          />
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
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
          <p className="text-gray-500">Aucune transaction</p>
          {hasFilters && (
            <button onClick={clearFilters} className="btn-secondary mt-3 text-sm">
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {["Date", "Référence", "Type", "Montant", "Échéance", "Statut", "Actions"].map((h) => (
                    <th key={h} className={`px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500 ${h === "Montant" ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-gray-50 transition-colors ${tx.status === "late" ? "bg-red-50/40" : ""}`}
                  >
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(tx.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-primary-600">{tx.reference}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {TYPE_LABELS[tx.type as TransactionType] ?? tx.type}
                      {tx.notes && (
                        <p className="mt-0.5 truncate max-w-40 text-xs text-gray-400">{tx.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      CHF {tx.amount.toLocaleString("fr-CH")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {tx.due_date ? new Date(tx.due_date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <RentStatusBadge status={tx.status as TransactionStatus} />
                    </td>
                    <td className="px-4 py-3">
                      {tx.status === "pending" || tx.status === "late" ? (
                        <button
                          onClick={() => markPaid.mutate(tx.id)}
                          disabled={markPaid.isPending}
                          title="Marquer comme payé"
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Payé
                        </button>
                      ) : tx.status === "paid" && tx.paid_at ? (
                        <span className="text-xs text-gray-400">
                          {new Date(tx.paid_at).toLocaleDateString("fr-FR")}
                        </span>
                      ) : null}
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
