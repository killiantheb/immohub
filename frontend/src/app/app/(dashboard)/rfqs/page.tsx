"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Clock, CheckCircle2, XCircle, Star, FileText, Loader2 } from "lucide-react";
import { useRFQs } from "@/lib/hooks/useRFQ";
import type { RFQStatus } from "@/lib/types";

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

const STATUS_TABS: { value: RFQStatus | ""; label: string }[] = [
  { value: "",              label: "Tous" },
  { value: "published",     label: "Publiés" },
  { value: "quotes_received", label: "Devis reçus" },
  { value: "accepted",      label: "Acceptés" },
  { value: "in_progress",   label: "En cours" },
  { value: "completed",     label: "Terminés" },
  { value: "rated",         label: "Notés" },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: React.ElementType }> = {
  draft:           { label: "Brouillon",    bg: S.surface2, color: S.text3,   icon: FileText },
  published:       { label: "Publié",       bg: S.blueBg,   color: S.blue,    icon: Clock },
  quotes_received: { label: "Devis reçus",  bg: S.orangeBg, color: S.orange,  icon: FileText },
  accepted:        { label: "Accepté",      bg: S.orangeBg, color: S.orange,  icon: CheckCircle2 },
  in_progress:     { label: "En cours",     bg: S.amberBg,  color: S.amber,   icon: Clock },
  completed:       { label: "Terminé",      bg: S.greenBg,  color: S.green,   icon: CheckCircle2 },
  rated:           { label: "Noté",         bg: S.greenBg,  color: S.green,   icon: Star },
  cancelled:       { label: "Annulé",       bg: S.redBg,    color: S.red,     icon: XCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: "Plomberie", electricity: "Électricité", cleaning: "Nettoyage",
  painting: "Peinture", locksmith: "Serrurerie", roofing: "Toiture",
  gardening: "Jardinage", masonry: "Maçonnerie", hvac: "Climatisation",
  renovation: "Rénovation", other: "Autre",
};

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  low:       { label: "Non urgent",  color: S.green },
  medium:    { label: "Normal",      color: S.blue },
  high:      { label: "Urgent",      color: S.orange },
  emergency: { label: "Urgence",     color: S.red },
};

export default function RFQsPage() {
  const [activeTab, setActiveTab] = useState<RFQStatus | "">("");
  const { data, isLoading, error } = useRFQs(activeTab as RFQStatus | undefined);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontWeight: 400, fontSize: 28, color: S.text }}>
            Appels d'offres
          </h1>
          <p style={{ marginTop: 4, fontSize: 14, color: S.text3 }}>
            Gérez vos demandes de travaux et comparez les devis reçus.
          </p>
        </div>
        <Link
          href="/app/rfqs/new"
          className="btn-primary flex items-center gap-2 px-4 py-2"
          style={{ background: S.orange, color: "#fff" }}
        >
          <Plus className="h-4 w-4" />
          Nouvel appel d'offre
        </Link>
      </div>

      {/* Tabs */}
      <div
        className="mb-6 flex gap-1 overflow-x-auto rounded-lg p-1"
        style={{ border: `1px solid ${S.border}`, background: S.surface }}
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            style={
              activeTab === tab.value
                ? { background: S.orange, color: "#fff" }
                : { color: S.text2 }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: S.orange }} />
        </div>
      )}

      {error && (
        <div
          className="rounded-lg p-4 text-sm"
          style={{ border: `1px solid ${S.red}`, background: S.redBg, color: S.red }}
        >
          Erreur lors du chargement des appels d'offres.
        </div>
      )}

      {data && data.items.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20"
          style={{ borderColor: S.border }}
        >
          <FileText className="mb-3 h-10 w-10" style={{ color: S.text3 }} />
          <p className="text-sm font-medium" style={{ color: S.text2 }}>Aucun appel d'offre</p>
          <Link
            href="/app/rfqs/new"
            className="mt-4 flex items-center gap-1 text-sm font-medium hover:underline"
            style={{ color: S.orange }}
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
            const urgency = URGENCY_CONFIG[rfq.urgency];
            return (
              <Link
                key={rfq.id}
                href={`/rfqs/${rfq.id}`}
                className="flex items-center justify-between gap-4 rounded-xl p-4 transition-colors"
                style={{
                  background: S.surface,
                  border: `1px solid ${S.border}`,
                  borderRadius: 14,
                  boxShadow: S.shadow,
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold" style={{ color: S.text }}>{rfq.title}</h3>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: S.text3 }}>
                    <span>{CATEGORY_LABELS[rfq.category] ?? rfq.category}</span>
                    {rfq.city && <span>• {rfq.city}</span>}
                    <span style={{ color: urgency?.color }}>• {urgency?.label}</span>
                    {rfq.quotes.length > 0 && (
                      <span className="font-medium" style={{ color: S.orange }}>
                        • {rfq.quotes.length} devis
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {rfq.budget_max && (
                    <p className="text-sm font-semibold" style={{ color: S.text }}>
                      jusqu'à {rfq.budget_max.toLocaleString("fr-FR")} €
                    </p>
                  )}
                  <p className="text-xs" style={{ color: S.text3 }}>
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
