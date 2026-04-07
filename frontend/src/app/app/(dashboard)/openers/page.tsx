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

// ── Labels ─────────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<MissionType, string> = {
  visit: "Visite",
  check_in: "Remise de clés",
  check_out: "État des lieux sortant",
  inspection: "Inspection",
  photography: "Photographie",
  other: "Autre",
};

const STATUS_CONFIG: Record<MissionStatus, { label: string; className: string }> = {
  pending:     { label: "En attente",   className: "bg-amber-100 text-amber-700" },
  confirmed:   { label: "Confirmée",    className: "bg-blue-100 text-blue-700" },
  in_progress: { label: "En cours",     className: "bg-indigo-100 text-indigo-700" },
  completed:   { label: "Terminée",     className: "bg-green-100 text-green-700" },
  cancelled:   { label: "Annulée",      className: "bg-gray-100 text-gray-500" },
};

function MissionStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as MissionStatus] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
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
          <h1 className="text-2xl font-bold text-gray-900">Missions ouvreurs</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {data ? `${data.total} mission${data.total !== 1 ? "s" : ""}` : "Marketplace ouvreurs de porte"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/openers/map" className="btn-secondary flex items-center gap-2 text-sm">
            <Map className="h-4 w-4" />
            Carte
          </Link>
          <Link href="/app/openers/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="h-4 w-4" />
            Nouvelle mission
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {([["requested", "Mes demandes"], ["my", "Mes missions"]] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => { setTab(value); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === value
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
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
          className="input w-auto"
        >
          <option value="">Tous les statuts</option>
          {(Object.entries(STATUS_CONFIG) as [MissionStatus, { label: string }][]).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
        {statusFilter && (
          <button onClick={() => setStatusFilter("")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <X className="h-4 w-4" /> Effacer
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="card py-16 text-center text-gray-500">Erreur lors du chargement</div>
      ) : !data?.items.length ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <p className="text-gray-500">Aucune mission</p>
          <Link href="/app/openers/new" className="btn-primary mt-4 text-sm">
            Créer une mission
          </Link>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {["Type", "Planifiée", "Prix", "Statut", "Note", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <Link href={`/openers/${m.id}`} className="hover:text-primary-600 hover:underline">
                        {TYPE_LABELS[m.type] ?? m.type}
                      </Link>
                      {m.notes && (
                        <p className="mt-0.5 truncate max-w-40 text-xs text-gray-400">{m.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(m.scheduled_at).toLocaleString("fr-FR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {m.price != null ? `${m.price.toLocaleString("fr-FR")} €` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <MissionStatusBadge status={m.status} />
                    </td>
                    <td className="px-4 py-3">
                      {m.rating_given != null ? (
                        <span className="flex items-center gap-0.5 text-amber-500">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          <span className="text-xs font-medium text-gray-700">{m.rating_given}</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {(m.status === "pending" || m.status === "confirmed") && (
                        <button
                          onClick={() => cancel.mutate({ id: m.id })}
                          disabled={cancel.isPending}
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
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
