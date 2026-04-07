"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { useAdminTransactions, type AdminTransaction } from "@/lib/hooks/useAdmin";
import { RentStatusBadge } from "@/components/RentStatusBadge";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  rent: "Loyer",
  commission: "Commission",
  deposit: "Dépôt",
  service: "Service",
  quote: "Devis",
};

const TYPE_COLORS: Record<string, string> = {
  rent: "bg-blue-100 text-blue-700",
  commission: "bg-orange-100 text-orange-700",
  deposit: "bg-purple-100 text-purple-700",
  service: "bg-gray-100 text-gray-700",
  quote: "bg-amber-100 text-amber-700",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[type] ?? "bg-gray-100 text-gray-600"}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(rows: AdminTransaction[]) {
  const headers = [
    "Référence", "Type", "Statut", "Montant (€)", "Commission (€)",
    "Propriétaire", "Bien", "Échéance", "Payé le", "Créé le",
  ];
  const lines = rows.map((t) => [
    t.reference,
    TYPE_LABELS[t.type] ?? t.type,
    t.status,
    t.amount.toFixed(2),
    t.commission_amount?.toFixed(2) ?? "",
    t.owner_id,
    t.property_id ?? "",
    t.due_date ? new Date(t.due_date).toLocaleDateString("fr-FR") : "",
    t.paid_at ? new Date(t.paid_at).toLocaleDateString("fr-FR") : "",
    new Date(t.created_at).toLocaleDateString("fr-FR"),
  ]);

  const csv = [headers, ...lines]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminTransactionsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const { data, isLoading } = useAdminTransactions(page, typeFilter, statusFilter);

  const types = ["rent", "commission", "deposit", "service", "quote"];
  const statuses = ["pending", "paid", "late", "cancelled"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/app/admin" className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;admin
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Toutes les transactions</h1>
          <p className="text-sm text-gray-500">
            {data ? `${data.total} transactions` : "Chargement…"}
          </p>
        </div>
        {data && data.items.length > 0 && (
          <button
            onClick={() => exportCsv(data.items)}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download className="h-4 w-4" />
            Exporter CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={typeFilter ?? ""}
          onChange={(e) => { setTypeFilter(e.target.value || undefined); setPage(1); }}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
        >
          <option value="">Tous les types</option>
          {types.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>

        <select
          value={statusFilter ?? ""}
          onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
        >
          <option value="">Tous les statuts</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Référence", "Type", "Statut", "Montant", "Commission", "Échéance", "Payé le", "Créé le"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-3.5 w-20 animate-pulse rounded bg-gray-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.items.map((tx) => (
                    <tr
                      key={tx.id}
                      className="border-b border-gray-50 transition-colors hover:bg-gray-50/50"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-gray-700">
                        {tx.reference}
                      </td>
                      <td className="px-5 py-3.5">
                        <TypeBadge type={tx.type} />
                      </td>
                      <td className="px-5 py-3.5">
                        <RentStatusBadge status={tx.status} />
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">
                        {fmt(tx.amount)}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        {tx.commission_amount != null ? fmt(tx.commission_amount) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">
                        {tx.due_date
                          ? new Date(tx.due_date).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">
                        {tx.paid_at
                          ? new Date(tx.paid_at).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-400">
                        {new Date(tx.created_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
            <p className="text-xs text-gray-400">
              Page {data.page} / {data.pages} — {data.total} résultats
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
