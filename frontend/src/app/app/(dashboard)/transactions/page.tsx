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
import { C } from "@/lib/design-tokens";

// ── Althy tokens ──────────────────────────────────────────────────────────────

// ── Labels ────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<TransactionType, string> = {
  rent: "Loyer",
  commission: "Commission",
  deposit: "Dépôt",
  service: "Service",
  quote: "Devis",
};

// ── Shared input / button styles ──────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.surface,
  fontSize: 14,
  color: C.text,
  fontFamily: "inherit",
  outline: "none",
};

const btnSecondaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text2,
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  boxShadow: C.shadow,
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
  // Deep-link: ?status=late (from Sphère) ou ?filter=impaye (alias)
  const initialStatus = searchParams.get("status") ?? (searchParams.get("filter") === "impaye" ? "late" : "");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
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
    <div style={{ fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 400, color: C.text, margin: 0 }}>Transactions</h1>
          <p style={{ marginTop: 4, fontSize: 13, color: C.text3 }}>
            {data ? `${data.total} transaction${data.total !== 1 ? "s" : ""}` : "Historique financier"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowChart((v) => !v)}
            style={btnSecondaryStyle}
          >
            {showChart ? "Masquer graphique" : "Voir graphique"}
          </button>
          <button
            onClick={() => generateRents.mutate()}
            disabled={generateRents.isPending}
            style={{ ...btnSecondaryStyle, opacity: generateRents.isPending ? 0.6 : 1 }}
            title="Générer les loyers du mois"
          >
            <RefreshCw style={{ width: 16, height: 16, animation: generateRents.isPending ? "spin 1s linear infinite" : undefined }} />
            Générer loyers
          </button>
          {filtered.length > 0 && (
            <button
              onClick={() => exportCSV(filtered)}
              style={btnSecondaryStyle}
            >
              <Download style={{ width: 16, height: 16 }} />
              Export CSV
            </button>
          )}
          <button
            onClick={() => {
              const year = new Date().getFullYear();
              window.open(`${baseURL}/transactions/export-csv?year=${year}`, '_blank');
            }}
            style={btnSecondaryStyle}
            title="Export comptable avec catégories fiscales suisses"
          >
            <Download style={{ width: 16, height: 16 }} />
            Fiscal CH {new Date().getFullYear()}
          </button>
        </div>
      </div>

      {/* Revenue chart (collapsible) */}
      {showChart && stats && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px", marginBottom: 24, boxShadow: C.shadow }}>
          <h2 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: C.text2 }}>Revenus loyers — 12 mois</h2>
          <RevenueChart data={stats.by_month} height={180} />
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 16, borderTop: `1px solid ${C.border}`, paddingTop: 12, fontSize: 14 }}>
            {[
              { label: "Total encaissé", value: `CHF ${stats.total.toLocaleString("fr-CH")}`, color: C.green },
              { label: "En attente", value: stats.pending_count, color: C.amber },
              { label: "Impayés", value: stats.late_count, color: C.red },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p style={{ color: C.text3, margin: 0, fontSize: 13 }}>{label}</p>
                <p style={{ fontWeight: 600, color, margin: 0, fontSize: 14 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: 20, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16, boxShadow: C.shadow }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: C.text3 }} />
            <input
              type="search"
              placeholder="Référence, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36, width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="paid">Payé</option>
            <option value="late">Impayé</option>
            <option value="cancelled">Annulé</option>
          </select>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} style={inputStyle}>
            <option value="">Tous les types</option>
            {(Object.entries(TYPE_LABELS) as [TransactionType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
            style={inputStyle}
          />
          {hasFilters && (
            <button onClick={clearFilters} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: C.text2, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <X style={{ width: 16, height: 16 }} /> Effacer
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: `4px solid ${C.orange}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : isError ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "4rem", textAlign: "center", color: C.text2, boxShadow: C.shadow }}>Erreur lors du chargement</div>
      ) : !filtered.length ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "4rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", boxShadow: C.shadow }}>
          <p style={{ color: C.text2, margin: 0 }}>Aucune transaction</p>
          {hasFilters && (
            <button onClick={clearFilters} style={{ ...btnSecondaryStyle, marginTop: 12, fontSize: 13 }}>
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: C.shadow }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead style={{ borderBottom: `1px solid ${C.border}`, background: C.bg }}>
                  <tr>
                    {["Date", "Référence", "Type", "Montant", "Échéance", "Statut", "Actions"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "1.5px", color: C.text3, textAlign: h === "Montant" ? "right" : "left", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx, idx) => (
                    <tr
                      key={tx.id}
                      style={{ borderBottom: `1px solid ${C.border}`, background: tx.status === "late" ? C.redBg : "transparent" }}
                    >
                      <td style={{ padding: "12px 16px", color: C.text2 }}>
                        {new Date(tx.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: 12, color: C.orange }}>{tx.reference}</td>
                      <td style={{ padding: "12px 16px", color: C.text }}>
                        {TYPE_LABELS[tx.type as TransactionType] ?? tx.type}
                        {tx.notes && (
                          <p style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160, fontSize: 12, color: C.text3 }}>{tx.notes}</p>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: C.text }}>
                        CHF {tx.amount.toLocaleString("fr-CH")}
                      </td>
                      <td style={{ padding: "12px 16px", color: C.text2 }}>
                        {tx.due_date ? new Date(tx.due_date).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <RentStatusBadge status={tx.status as TransactionStatus} />
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {tx.status === "pending" || tx.status === "late" ? (
                          <button
                            onClick={() => markPaid.mutate(tx.id)}
                            disabled={markPaid.isPending}
                            title="Marquer comme payé"
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 8, padding: "4px 8px", fontSize: 12, fontWeight: 500, color: C.green, background: C.greenBg, border: "none", cursor: "pointer", fontFamily: "inherit", opacity: markPaid.isPending ? 0.5 : 1 }}
                          >
                            <CheckCircle style={{ width: 14, height: 14 }} />
                            Payé
                          </button>
                        ) : tx.status === "paid" && tx.paid_at ? (
                          <span style={{ fontSize: 12, color: C.text3 }}>
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
            <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ ...btnSecondaryStyle, opacity: page === 1 ? 0.4 : 1 }}>
                <ChevronLeft style={{ width: 16, height: 16 }} /> Précédent
              </button>
              <span style={{ fontSize: 13, color: C.text2 }}>Page {page} / {data.pages}</span>
              <button onClick={() => setPage((p) => Math.min(data.pages, p + 1))} disabled={page === data.pages} style={{ ...btnSecondaryStyle, opacity: page === data.pages ? 0.4 : 1 }}>
                Suivant <ChevronRight style={{ width: 16, height: 16 }} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
