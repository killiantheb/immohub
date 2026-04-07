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

function Timeline({ rfq }: { rfq: RFQ }) {
  const stepIndex = STATUS_STEPS.findIndex((s) => s.key === rfq.status);
  const currentIdx = stepIndex === -1 ? 0 : stepIndex;

  return (
    <div className="card">
      <h2 className="mb-4 text-base font-semibold text-gray-800">Avancement</h2>
      <div className="relative">
        <div className="absolute left-4 top-0 h-full w-0.5 bg-gray-100" />
        <ul className="space-y-4">
          {STATUS_STEPS.map((step, i) => {
            const done = i <= currentIdx;
            const current = i === currentIdx;
            return (
              <li key={step.key} className="relative flex items-center gap-4 pl-10">
                <span
                  className={`absolute left-2 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    done
                      ? "border-orange-500 bg-orange-500"
                      : "border-gray-200 bg-white"
                  } ${current ? "ring-2 ring-orange-200" : ""}`}
                >
                  {done && <CheckCircle2 className="h-3 w-3 text-white" />}
                </span>
                <span
                  className={`text-sm ${
                    current
                      ? "font-semibold text-orange-700"
                      : done
                      ? "text-gray-700"
                      : "text-gray-400"
                  }`}
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
  const statusColors: Record<string, string> = {
    pending:   "bg-blue-100 text-blue-700",
    accepted:  "bg-green-100 text-green-700",
    rejected:  "bg-red-100 text-red-700",
    completed: "bg-teal-100 text-teal-700",
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isSelected
          ? "border-orange-400 bg-orange-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-gray-900">
              {quote.amount.toLocaleString("fr-FR")} €
            </p>
            {isSelected && (
              <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                <Award className="h-3 w-3" />
                Retenu
              </span>
            )}
          </div>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[quote.status] ?? ""}`}>
            {quote.status === "pending" ? "En attente" :
             quote.status === "accepted" ? "Accepté" :
             quote.status === "rejected" ? "Refusé" : "Terminé"}
          </span>
        </div>
        {canAccept && quote.status === "pending" && (
          <button
            onClick={() => onAccept(quote.id)}
            disabled={isAccepting}
            className="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {isAccepting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Accepter"}
          </button>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-600">{quote.description}</p>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
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
        <p className="mt-2 text-xs text-gray-400 italic">{quote.notes}</p>
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
    <div className="card space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Noter l'intervention</h2>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`h-8 w-8 ${
                star <= rating ? "fill-orange-400 text-orange-400" : "text-gray-300"
              }`}
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
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !rfq) {
    return (
      <div className="px-4 py-8">
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
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
  const cheapestId = sortedQuotes[0]?.id;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{rfq.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
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
              className="shrink-0 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-60"
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
          <div className="card">
            <h2 className="mb-2 text-base font-semibold text-gray-800">Description</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{rfq.description}</p>
          </div>

          {/* Quotes */}
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">
                Devis reçus{" "}
                <span className="text-sm font-normal text-gray-400">
                  ({rfq.quotes.length})
                </span>
              </h2>
              {sortedQuotes.length > 1 && (
                <span className="text-xs text-gray-400">Triés par montant</span>
              )}
            </div>

            {rfq.quotes.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Clock className="mb-2 h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500">
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
              <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                <p>
                  Fourchette : <strong>{sortedQuotes[0]?.amount.toLocaleString("fr-FR")} €</strong>
                  {" — "}
                  <strong>{sortedQuotes[sortedQuotes.length - 1]?.amount.toLocaleString("fr-FR")} €</strong>
                </p>
                <p className="mt-1">
                  Meilleur prix : devis à{" "}
                  <strong className="text-orange-700">
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
            <div className="card">
              <h2 className="mb-3 text-base font-semibold text-gray-800">Votre évaluation</h2>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${
                      star <= rfq.rating_given!
                        ? "fill-orange-400 text-orange-400"
                        : "text-gray-200"
                    }`}
                  />
                ))}
                <span className="ml-2 text-sm text-gray-500">{rfq.rating_given}/5</span>
              </div>
              {rfq.rating_comment && (
                <p className="mt-2 text-sm text-gray-600 italic">{rfq.rating_comment}</p>
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
            <div className="card">
              <h2 className="mb-2 text-sm font-semibold text-gray-600">Commission CATHY</h2>
              <p className="text-xl font-bold text-orange-600">
                {rfq.commission_amount.toLocaleString("fr-FR")} €
              </p>
              <p className="text-xs text-gray-400">10% du montant retenu</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
