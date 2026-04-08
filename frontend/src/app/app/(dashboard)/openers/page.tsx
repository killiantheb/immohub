"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Map,
  Plus,
  Star,
  X,
} from "lucide-react";
import {
  useCancelMission,
  useMyMissions,
  useRequestedMissions,
} from "@/lib/hooks/useOpeners";
import type { MissionStatus, MissionType } from "@/lib/types";

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

// ── Labels ─────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<MissionType, string> = {
  visit: "Visite",
  check_in: "Remise de clés",
  check_out: "État des lieux sortant",
  inspection: "Inspection",
  photography: "Photographie",
  other: "Autre",
};

const STATUS_CONFIG: Record<MissionStatus, { label: string; bg: string; color: string }> = {
  pending:     { label: "En attente",   bg: S.amberBg, color: S.amber },
  confirmed:   { label: "Confirmée",    bg: S.blueBg,  color: S.blue },
  in_progress: { label: "En cours",     bg: S.orangeBg, color: S.orange },
  completed:   { label: "Terminée",     bg: S.greenBg, color: S.green },
  cancelled:   { label: "Annulée",      bg: S.surface2, color: S.text3 },
};

function MissionStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as MissionStatus] ?? { label: status, bg: S.surface2, color: S.text3 };
  return (
    <span style={{
      display: "inline-block",
      borderRadius: 999,
      padding: "2px 10px",
      fontSize: 12,
      fontWeight: 500,
      background: cfg.bg,
      color: cfg.color,
    }}>
      {cfg.label}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function OpenersPage() {
  const [tab, setTab] = useState<"requested" | "my">("requested");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const requestedQ = useRequestedMissions({
    status: (statusFilter as MissionStatus) || undefined,
    page,
    size: 20,
  });
  const myQ = useMyMissions({
    status: (statusFilter as MissionStatus) || undefined,
    page,
    size: 20,
  });

  const { data, isLoading, isError } = tab === "requested" ? requestedQ : myQ;
  const cancel = useCancelMission();

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontWeight: 400, fontSize: 28, color: S.text, margin: 0 }}>
            Missions ouvreurs
          </h1>
          <p style={{ marginTop: 4, fontSize: 13, color: S.text3 }}>
            {data ? `${data.total} mission${data.total !== 1 ? "s" : ""}` : "Marketplace ouvreurs de porte"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/openers/map"
            className="flex items-center gap-2 text-sm"
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: `1px solid ${S.border}`,
              background: S.surface,
              color: S.text2,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            <Map className="h-4 w-4" />
            Carte
          </Link>
          <Link
            href="/app/openers/new"
            className="flex items-center gap-2 text-sm"
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              background: S.orange,
              color: "#fff",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            <Plus className="h-4 w-4" />
            Nouvelle mission
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1" style={{ borderBottom: `1px solid ${S.border}` }}>
        {([["requested", "Mes demandes"], ["my", "Mes missions"]] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => { setTab(value); setPage(1); }}
            className="px-4 py-2 text-sm font-medium -mb-px transition-colors"
            style={{
              borderBottom: tab === value ? `2px solid ${S.orange}` : "2px solid transparent",
              color: tab === value ? S.orange : S.text3,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: "8px 16px",
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: `1px solid ${S.border}`,
            background: S.surface,
            color: S.text,
            fontSize: 14,
            fontFamily: "inherit",
            outline: "none",
          }}
        >
          <option value="">Tous les statuts</option>
          {(Object.entries(STATUS_CONFIG) as [MissionStatus, { label: string }][]).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
        {statusFilter && (
          <button
            onClick={() => setStatusFilter("")}
            className="flex items-center gap-1 text-sm"
            style={{ color: S.text3, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <X className="h-4 w-4" /> Effacer
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: S.orange, borderTopColor: "transparent" }} />
        </div>
      ) : isError ? (
        <div className="py-16 text-center" style={{ background: S.surface, borderRadius: 14, border: `1px solid ${S.border}`, color: S.text3 }}>
          Erreur lors du chargement
        </div>
      ) : !data?.items.length ? (
        <div className="flex flex-col items-center py-16 text-center" style={{ background: S.surface, borderRadius: 14, border: `1px solid ${S.border}`, boxShadow: S.shadow }}>
          <p style={{ color: S.text3, fontSize: 14 }}>Aucune mission</p>
          <Link
            href="/app/openers/new"
            style={{
              marginTop: 16,
              padding: "8px 20px",
              borderRadius: 10,
              background: S.orange,
              color: "#fff",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Créer une mission
          </Link>
        </div>
      ) : (
        <>
          <div style={{ background: S.surface, borderRadius: 14, border: `1px solid ${S.border}`, boxShadow: S.shadow, overflow: "hidden" }}>
            <table className="w-full text-sm">
              <thead style={{ borderBottom: `1px solid ${S.border}`, background: S.surface2 }}>
                <tr>
                  {["Type", "Planifiée", "Prix", "Statut", "Note", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left" style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: S.text3 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((m) => (
                  <tr key={m.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                    <td className="px-4 py-3" style={{ fontWeight: 500, color: S.text }}>
                      <Link href={`/openers/${m.id}`} style={{ color: S.orange, textDecoration: "none" }}>
                        {TYPE_LABELS[m.type] ?? m.type}
                      </Link>
                      {m.notes && (
                        <p className="mt-0.5 truncate max-w-40" style={{ fontSize: 11, color: S.text3 }}>{m.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: S.text2 }}>
                      {new Date(m.scheduled_at).toLocaleString("fr-FR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3" style={{ fontWeight: 500, color: S.text }}>
                      {m.price != null ? `${m.price.toLocaleString("fr-FR")} €` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <MissionStatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3">
                      {m.rating_given != null ? (
                        <span className="flex items-center gap-0.5" style={{ color: S.amber }}>
                          <Star className="h-3.5 w-3.5 fill-current" />
                          <span style={{ fontSize: 12, fontWeight: 500, color: S.text2 }}>{m.rating_given}</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {(m.status === "pending" || m.status === "confirmed") && (
                        <button
                          onClick={() => cancel.mutate({ id: m.id })}
                          disabled={cancel.isPending}
                          style={{
                            borderRadius: 8,
                            padding: "4px 10px",
                            fontSize: 12,
                            color: S.red,
                            background: "transparent",
                            border: `1px solid ${S.border}`,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            opacity: cancel.isPending ? 0.5 : 1,
                          }}
                        >
                          Annuler
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: `1px solid ${S.border}`,
                  background: S.surface,
                  color: S.text2,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  opacity: page === 1 ? 0.4 : 1,
                }}
              >
                <ChevronLeft className="h-4 w-4" /> Précédent
              </button>
              <span style={{ fontSize: 13, color: S.text2 }}>Page {page} / {data.pages}</span>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="flex items-center gap-1"
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: `1px solid ${S.border}`,
                  background: S.surface,
                  color: S.text2,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  opacity: page === data.pages ? 0.4 : 1,
                }}
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
