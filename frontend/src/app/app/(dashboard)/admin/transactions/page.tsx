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
import { C } from "@/lib/design-tokens";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  rent: "Loyer",
  commission: "Commission",
  deposit: "Dépôt",
  service: "Service",
  quote: "Devis",
};

type TypeKey = "rent" | "commission" | "deposit" | "service" | "quote";

const TYPE_BADGE_STYLES: Record<TypeKey, { bg: string; color: string }> = {
  rent: { bg: C.blueBg, color: C.blue },
  commission: { bg: C.orangeBg, color: C.orange },
  deposit: { bg: C.orangeBg, color: C.orange },
  service: { bg: C.surface2, color: C.text2 },
  quote: { bg: C.amberBg, color: C.amber },
};

function TypeBadge({ type }: { type: string }) {
  const style = TYPE_BADGE_STYLES[type as TypeKey] ?? { bg: C.surface2, color: C.text2 };
  return (
    <span
      style={{
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 500,
        background: style.bg,
        color: style.color,
        display: "inline-block",
      }}
    >
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

  const inputStyle = {
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    background: C.surface,
    padding: "8px 12px",
    fontSize: 14,
    color: C.text,
    outline: "none",
  };

  const TABLE_HEADERS = ["Référence", "Type", "Statut", "Montant", "Commission", "Échéance", "Payé le", "Créé le"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/app/admin"
            style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 4, fontSize: 14, color: C.text2, textDecoration: "none" }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            Retour à l&apos;admin
          </Link>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: 24,
              color: C.text,
            }}
          >
            Toutes les transactions
          </h1>
          <p style={{ fontSize: 14, color: C.text2 }}>
            {data ? `${data.total} transactions` : "Chargement…"}
          </p>
        </div>
        {data && data.items.length > 0 && (
          <button
            onClick={() => exportCsv(data.items)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: C.surface,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              color: C.text,
              cursor: "pointer",
              boxShadow: C.shadow,
              transition: "background 0.15s",
            }}
          >
            <Download style={{ width: 16, height: 16 }} />
            Exporter CSV
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={typeFilter ?? ""}
          onChange={(e) => { setTypeFilter(e.target.value || undefined); setPage(1); }}
          style={inputStyle}
        >
          <option value="">Tous les types</option>
          {types.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>

        <select
          value={statusFilter ?? ""}
          onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}
          style={inputStyle}
        >
          <option value="">Tous les statuts</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        style={{
          overflow: "hidden",
          borderRadius: 20,
          border: `1px solid ${C.border}`,
          background: C.surface,
          boxShadow: C.shadow,
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
                {TABLE_HEADERS.map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "14px 20px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: C.text3,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} style={{ padding: "14px 20px" }}>
                          <div
                            className="animate-pulse"
                            style={{ height: 14, width: 80, borderRadius: 6, background: C.surface2 }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                : data?.items.map((tx) => (
                    <tr
                      key={tx.id}
                      style={{ borderBottom: `1px solid ${C.border}` }}
                    >
                      <td style={{ padding: "14px 20px", fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: C.text }}>
                        {tx.reference}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <TypeBadge type={tx.type} />
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <RentStatusBadge status={tx.status} />
                      </td>
                      <td style={{ padding: "14px 20px", fontWeight: 600, color: C.text }}>
                        {fmt(tx.amount)}
                      </td>
                      <td style={{ padding: "14px 20px", color: C.text2 }}>
                        {tx.commission_amount != null ? fmt(tx.commission_amount) : "—"}
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.text3 }}>
                        {tx.due_date
                          ? new Date(tx.due_date).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.text3 }}>
                        {tx.paid_at
                          ? new Date(tx.paid_at).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: C.text3 }}>
                        {new Date(tx.created_at).toLocaleDateString("fr-FR")}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div
            className="flex items-center justify-between"
            style={{ borderTop: `1px solid ${C.border}`, padding: "12px 20px" }}
          >
            <p style={{ fontSize: 12, color: C.text3 }}>
              Page {data.page} / {data.pages} — {data.total} résultats
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  padding: 6,
                  background: C.surface,
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  opacity: page <= 1 ? 0.4 : 1,
                  color: C.text,
                }}
              >
                <ChevronLeft style={{ width: 16, height: 16 }} />
              </button>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  padding: 6,
                  background: C.surface,
                  cursor: page >= data.pages ? "not-allowed" : "pointer",
                  opacity: page >= data.pages ? 0.4 : 1,
                  color: C.text,
                }}
              >
                <ChevronRight style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
