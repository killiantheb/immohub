"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Star,
  Loader2,
  AlertCircle,
  Award,
  Calendar,
  MapPin,
  Euro,
  Shield,
} from "lucide-react";
import {
  useRFQ,
  useAcceptQuote,
  useCompleteRFQ,
  useRateRFQ,
} from "@/lib/hooks/useRFQ";
import type { RFQ, RFQQuote } from "@/lib/types";
import { RatingWidget } from "@/components/RatingWidget";
import { C } from "@/lib/design-tokens";

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: "Plomberie", electricity: "Électricité", cleaning: "Nettoyage",
  painting: "Peinture", locksmith: "Serrurerie", roofing: "Toiture",
  gardening: "Jardinage", masonry: "Maçonnerie", hvac: "Climatisation",
  renovation: "Rénovation", other: "Autre",
};

const STATUS_STEPS = [
  { key: "published",       label: "Publié" },
  { key: "quotes_received", label: "Devis reçus" },
  { key: "accepted",        label: "Devis accepté" },
  { key: "in_progress",     label: "En cours" },
  { key: "completed",       label: "Terminé" },
  { key: "rated",           label: "Noté" },
];

const cardStyle = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  boxShadow: C.shadow,
  padding: "1.25rem",
} as const;

function Timeline({ rfq }: { rfq: RFQ }) {
  const stepIndex = STATUS_STEPS.findIndex((s) => s.key === rfq.status);
  const currentIdx = stepIndex === -1 ? 0 : stepIndex;

  return (
    <div style={cardStyle}>
      <h2 className="mb-4 text-base font-semibold" style={{ color: C.text2 }}>Avancement</h2>
      <div className="relative">
        <div className="absolute left-4 top-0 h-full w-0.5" style={{ background: C.border }} />
        <ul className="space-y-4">
          {STATUS_STEPS.map((step, i) => {
            const done = i <= currentIdx;
            const current = i === currentIdx;
            return (
              <li key={step.key} className="relative flex items-center gap-4 pl-10">
                <span
                  className="absolute left-2 flex h-5 w-5 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: done ? C.orange : C.border,
                    background: done ? C.orange : C.surface,
                    boxShadow: current ? `0 0 0 3px ${C.orangeBg}` : undefined,
                  }}
                >
                  {done && <CheckCircle2 className="h-3 w-3" style={{ color: "#fff" }} />}
                </span>
                <span
                  className="text-sm"
                  style={{
                    fontWeight: current ? 600 : 400,
                    color: current ? C.orange : done ? C.text2 : C.text3,
                  }}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function QuoteCard({
  quote,
  isSelected,
  canAccept,
  onAccept,
  isAccepting,
}: {
  quote: RFQQuote;
  isSelected: boolean;
  canAccept: boolean;
  onAccept: (id: string) => void;
  isAccepting: boolean;
}) {
  const statusStyles: Record<string, { bg: string; color: string }> = {
    pending:   { bg: C.blueBg,  color: C.blue },
    accepted:  { bg: C.greenBg, color: C.green },
    rejected:  { bg: C.redBg,   color: C.red },
    completed: { bg: C.greenBg, color: C.green },
  };

  const ss = statusStyles[quote.status] ?? { bg: C.surface2, color: C.text3 };

  return (
    <div
      className="rounded-xl p-4 transition-colors"
      style={
        isSelected
          ? { border: `1px solid ${C.orange}`, background: C.orangeBg }
          : { border: `1px solid ${C.border}`, background: C.surface }
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold" style={{ color: C.text }}>
              {quote.amount.toLocaleString("fr-FR")} €
            </p>
            {isSelected && (
              <span
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: C.orangeBg, color: C.orange }}
              >
                <Award className="h-3 w-3" />
                Retenu
              </span>
            )}
          </div>
          <span
            className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: ss.bg, color: ss.color }}
          >
            {quote.status === "pending" ? "En attente" :
             quote.status === "accepted" ? "Accepté" :
             quote.status === "rejected" ? "Refusé" : "Terminé"}
          </span>
        </div>
        {canAccept && quote.status === "pending" && (
          <button
            onClick={() => onAccept(quote.id)}
            disabled={isAccepting}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
            style={{ background: C.orange, color: "#fff" }}
          >
            {isAccepting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Accepter"}
          </button>
        )}
      </div>

      <p className="mt-3 text-sm" style={{ color: C.text2 }}>{quote.description}</p>

      <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: C.text3 }}>
        {quote.delay_days && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {quote.delay_days} jour{quote.delay_days > 1 ? "s" : ""}
          </span>
        )}
        {quote.warranty_months != null && quote.warranty_months > 0 && (
          <span className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            Garantie {quote.warranty_months} mois
          </span>
        )}
      </div>

      {quote.notes && (
        <p className="mt-2 text-xs italic" style={{ color: C.text3 }}>{quote.notes}</p>
      )}
    </div>
  );
}

function RatingModal({
  onSubmit,
  isLoading,
}: {
  onSubmit: (rating: number, comment?: string) => void;
  isLoading: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  return (
    <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h2 className="text-base font-semibold" style={{ color: C.text2 }}>Noter l'intervention</h2>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className="h-8 w-8"
              style={
                star <= rating
                  ? { fill: C.orange, color: C.orange }
                  : { color: C.border }
              }
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Commentaire (optionnel)"
        rows={3}
        className="input resize-none"
      />
      <button
        onClick={() => rating > 0 && onSubmit(rating, comment || undefined)}
        disabled={rating === 0 || isLoading}
        className="btn-primary flex items-center gap-2 px-5 py-2 disabled:opacity-60"
        style={{ background: C.orange, color: "#fff" }}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
        Envoyer la note
      </button>
    </div>
  );
}

export default function RFQDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: rfq, isLoading, error } = useRFQ(id);
  const acceptQuote = useAcceptQuote(id);
  const completeRFQ = useCompleteRFQ(id);
  const rateRFQ = useRateRFQ(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.orange }} />
      </div>
    );
  }

  if (error || !rfq) {
    return (
      <div className="px-4 py-8">
        <div
          className="flex items-center gap-2 rounded-lg p-4 text-sm"
          style={{ border: `1px solid ${C.red}`, background: C.redBg, color: C.red }}
        >
          <AlertCircle className="h-4 w-4" />
          Appel d'offre introuvable.
        </div>
      </div>
    );
  }

  const canAcceptQuote = rfq.status === "quotes_received";
  const canComplete = rfq.status === "accepted" || rfq.status === "in_progress";
  const canRate = rfq.status === "completed";

  const sortedQuotes = [...rfq.quotes].sort((a, b) => a.amount - b.amount);

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1 text-sm"
          style={{ color: C.text3 }}
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: 28, color: C.text }}>
              {rfq.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: C.text3 }}>
              <span>{CATEGORY_LABELS[rfq.category] ?? rfq.category}</span>
              {rfq.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {rfq.city}
                </span>
              )}
              {rfq.budget_max && (
                <span className="flex items-center gap-1">
                  <Euro className="h-3 w-3" />
                  jusqu'à {rfq.budget_max.toLocaleString("fr-FR")} €
                </span>
              )}
              {rfq.scheduled_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(rfq.scheduled_date).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
          </div>
          {canComplete && (
            <button
              onClick={() => completeRFQ.mutate()}
              disabled={completeRFQ.isPending}
              className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
              style={{ background: C.green, color: "#fff" }}
            >
              {completeRFQ.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Marquer terminé"
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left — quotes comparator */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <div style={cardStyle}>
            <h2 className="mb-2 text-base font-semibold" style={{ color: C.text2 }}>Description</h2>
            <p className="text-sm leading-relaxed" style={{ color: C.text2 }}>{rfq.description}</p>
          </div>

          {/* Quotes */}
          <div style={cardStyle}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold" style={{ color: C.text2 }}>
                Devis reçus{" "}
                <span className="text-sm font-normal" style={{ color: C.text3 }}>
                  ({rfq.quotes.length})
                </span>
              </h2>
              {sortedQuotes.length > 1 && (
                <span className="text-xs" style={{ color: C.text3 }}>Triés par montant</span>
              )}
            </div>

            {rfq.quotes.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Clock className="mb-2 h-8 w-8" style={{ color: C.border }} />
                <p className="text-sm" style={{ color: C.text3 }}>
                  En attente de devis des prestataires…
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedQuotes.map((quote) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    isSelected={rfq.selected_quote_id === quote.id}
                    canAccept={canAcceptQuote}
                    onAccept={(qid) => acceptQuote.mutate(qid)}
                    isAccepting={acceptQuote.isPending}
                  />
                ))}
              </div>
            )}

            {/* Summary when multiple quotes */}
            {sortedQuotes.length >= 2 && (
              <div
                className="mt-4 rounded-lg p-3 text-xs"
                style={{ background: C.surface2, color: C.text2 }}
              >
                <p>
                  Fourchette : <strong>{sortedQuotes[0]?.amount.toLocaleString("fr-FR")} €</strong>
                  {" — "}
                  <strong>{sortedQuotes[sortedQuotes.length - 1]?.amount.toLocaleString("fr-FR")} €</strong>
                </p>
                <p className="mt-1">
                  Meilleur prix : devis à{" "}
                  <strong style={{ color: C.orange }}>
                    {sortedQuotes[0]?.amount.toLocaleString("fr-FR")} €
                  </strong>
                </p>
              </div>
            )}
          </div>

          {/* Rating */}
          {canRate && (
            <RatingModal
              onSubmit={(rating, comment) => rateRFQ.mutate({ rating, comment })}
              isLoading={rateRFQ.isPending}
            />
          )}

          {rfq.rating_given != null && (
            <div style={cardStyle}>
              <h2 className="mb-3 text-base font-semibold" style={{ color: C.text2 }}>Votre évaluation</h2>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className="h-5 w-5"
                    style={
                      star <= rfq.rating_given!
                        ? { fill: C.orange, color: C.orange }
                        : { color: C.border }
                    }
                  />
                ))}
                <span className="ml-2 text-sm" style={{ color: C.text3 }}>{rfq.rating_given}/5</span>
              </div>
              {rfq.rating_comment && (
                <p className="mt-2 text-sm italic" style={{ color: C.text2 }}>{rfq.rating_comment}</p>
              )}
            </div>
          )}

          {/* Avis universels sur la mission */}
          {(rfq.status === "completed" || rfq.status === "rated") && (
            <RatingWidget
              entityType="mission"
              entityId={rfq.id}
              title="Avis sur cette mission"
            />
          )}
        </div>

        {/* Right — timeline + meta */}
        <div className="space-y-4">
          <Timeline rfq={rfq} />

          {rfq.commission_amount != null && (
            <div style={cardStyle}>
              <h2 className="mb-2 text-sm font-semibold" style={{ color: C.text3 }}>Commission CATHY</h2>
              <p className="text-xl font-bold" style={{ color: C.orange }}>
                {rfq.commission_amount.toLocaleString("fr-FR")} €
              </p>
              <p className="text-xs" style={{ color: C.text3 }}>10% du montant retenu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
