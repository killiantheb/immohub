"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Clock, CheckCircle2, XCircle, Star, FileText, Loader2 } from "lucide-react";
import { useRFQs } from "@/lib/hooks/useRFQ";
import type { RFQStatus } from "@/lib/types";

const STATUS_TABS: { value: RFQStatus | ""; label: string }[] = [
  { value: "",              label: "Tous" },
  { value: "published",     label: "Publiés" },
  { value: "quotes_received", label: "Devis reçus" },
  { value: "accepted",      label: "Acceptés" },
  { value: "in_progress",   label: "En cours" },
  { value: "completed",     label: "Terminés" },
  { value: "rated",         label: "Notés" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:           { label: "Brouillon",      color: "bg-gray-100 text-gray-600",   icon: FileText },
  published:       { label: "Publié",         color: "bg-blue-100 text-blue-700",   icon: Clock },
  quotes_received: { label: "Devis reçus",   color: "bg-orange-100 text-orange-700", icon: FileText },
  accepted:        { label: "Accepté",        color: "bg-purple-100 text-purple-700", icon: CheckCircle2 },
  in_progress:     { label: "En cours",       color: "bg-yellow-100 text-yellow-700", icon: Clock },
  completed:       { label: "Terminé",        color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rated:           { label: "Noté",           color: "bg-teal-100 text-teal-700",   icon: Star },
  cancelled:       { label: "Annulé",         color: "bg-red-100 text-red-700",     icon: XCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: "Plomberie", electricity: "Électricité", cleaning: "Nettoyage",
  painting: "Peinture", locksmith: "Serrurerie", roofing: "Toiture",
  gardening: "Jardinage", masonry: "Maçonnerie", hvac: "Climatisation",
  renovation: "Rénovation", other: "Autre",
};

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  low:       { label: "Non urgent",  color: "text-green-600" },
  medium:    { label: "Normal",      color: "text-blue-600" },
  high:      { label: "Urgent",      color: "text-orange-600" },
  emergency: { label: "Urgence",     color: "text-red-600" },
};

export default function RFQsPage() {
  const [activeTab, setActiveTab] = useState<RFQStatus | "">("");
  const { data, isLoading, error } = useRFQs(activeTab as RFQStatus | undefined);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appels d'offres</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez vos demandes de travaux et comparez les devis reçus.
          </p>
        </div>
        <Link
          href="/app/rfqs/new"
          className="btn-primary flex items-center gap-2 px-4 py-2"
        >
          <Plus className="h-4 w-4" />
          Nouvel appel d'offre
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-orange-500 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erreur lors du chargement des appels d'offres.
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20">
          <FileText className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Aucun appel d'offre</p>
          <Link
            href="/app/rfqs/new"
            className="mt-4 flex items-center gap-1 text-sm font-medium text-orange-600 hover:underline"
          >
            <Plus className="h-4 w-4" />
            Créer votre premier appel d'offre
          </Link>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="space-y-3">
          {data.items.map((rfq) => {
            const cfg = STATUS_CONFIG[rfq.status] ?? STATUS_CONFIG.draft;
            const StatusIcon = cfg.icon;
            const urgency = URGENCY_CONFIG[rfq.urgency];
            return (
              <Link
                key={rfq.id}
                href={`/rfqs/${rfq.id}`}
                className="card flex items-center justify-between gap-4 hover:border-orange-200 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-gray-900">{rfq.title}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span>{CATEGORY_LABELS[rfq.category] ?? rfq.category}</span>
                    {rfq.city && <span>• {rfq.city}</span>}
                    <span className={urgency?.color}>• {urgency?.label}</span>
                    {rfq.quotes.length > 0 && (
                      <span className="font-medium text-orange-600">
                        • {rfq.quotes.length} devis
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {rfq.budget_max && (
                    <p className="text-sm font-semibold text-gray-900">
                      jusqu'à {rfq.budget_max.toLocaleString("fr-FR")} €
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(rfq.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
