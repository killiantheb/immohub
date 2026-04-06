"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Clock,
  FileText,
  MapPin,
  Star,
  XCircle,
} from "lucide-react";
import {
  useAcceptMission,
  useCancelMission,
  useCompleteMission,
  useMission,
  useRateMission,
} from "@/lib/hooks/useOpeners";
import type { MissionStatus, MissionType } from "@/lib/types";

const TYPE_LABELS: Record<MissionType, string> = {
  visit: "Visite",
  check_in: "Remise de clés",
  check_out: "État des lieux sortant",
  inspection: "Inspection",
  photography: "Photographie",
  other: "Autre",
};

const STATUS_CONFIG: Record<MissionStatus, { label: string; color: string }> = {
  pending:     { label: "En attente",   color: "text-amber-600 bg-amber-50 border-amber-200" },
  confirmed:   { label: "Confirmée",    color: "text-blue-700 bg-blue-50 border-blue-200" },
  in_progress: { label: "En cours",     color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  completed:   { label: "Terminée",     color: "text-green-700 bg-green-50 border-green-200" },
  cancelled:   { label: "Annulée",      color: "text-gray-600 bg-gray-50 border-gray-200" },
};

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Timeline ──────────────────────────────────────────────────────────────────

interface TimelineStep {
  key: string;
  label: string;
  date: string | null;
  done: boolean;
  cancelled?: boolean;
}

function MissionTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative ml-3 border-l border-gray-200">
      {steps.map((step, i) => (
        <li key={step.key} className="mb-6 ml-6 last:mb-0">
          <span
            className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
              step.cancelled
                ? "border-red-300 bg-red-50"
                : step.done
                ? "border-green-400 bg-green-50"
                : "border-gray-300 bg-white"
            }`}
          >
            {step.cancelled ? (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            ) : step.done ? (
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-gray-400" />
            )}
          </span>
          <p className={`text-sm font-medium ${step.done || step.cancelled ? "text-gray-800" : "text-gray-400"}`}>
            {step.label}
          </p>
          {step.date && (
            <p className="text-xs text-gray-400 mt-0.5">{fmt(step.date)}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

// ── Rate form ─────────────────────────────────────────────────────────────────

function RateForm({ missionId }: { missionId: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const rate = useRateMission();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        rate.mutate({ id: missionId, rating, comment: comment || undefined });
      }}
      className="space-y-3"
    >
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setRating(v)}
            className={`text-xl ${v <= rating ? "text-amber-400" : "text-gray-300"}`}
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm text-gray-500">{rating}/5</span>
      </div>
      <textarea
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="input resize-none"
        placeholder="Commentaire (optionnel)"
      />
      <button type="submit" disabled={rate.isPending} className="btn-primary text-sm">
        {rate.isPending ? "Envoi…" : "Soumettre la note"}
      </button>
    </form>
  );
}

// ── Complete form ─────────────────────────────────────────────────────────────

function CompleteForm({ missionId }: { missionId: string }) {
  const [reportText, setReportText] = useState("");
  const complete = useCompleteMission();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        complete.mutate({ id: missionId, report_text: reportText || undefined });
      }}
      className="space-y-3"
    >
      <textarea
        rows={4}
        value={reportText}
        onChange={(e) => setReportText(e.target.value)}
        className="input resize-none"
        placeholder="Rapport de mission (observations, remarques…)"
      />
      <button type="submit" disabled={complete.isPending} className="btn-primary text-sm">
        {complete.isPending ? "Enregistrement…" : "Marquer comme terminée"}
      </button>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function MissionDetailPage() {
  const { mission_id } = useParams<{ mission_id: string }>();
  const router = useRouter();
  const { data: mission, isLoading, isError } = useMission(mission_id);
  const accept = useAcceptMission();
  const cancel = useCancelMission();

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (isError || !mission) {
    return (
      <div className="card py-20 text-center text-gray-500">
        Mission introuvable.{" "}
        <Link href="/openers" className="text-primary-600 hover:underline">Retour</Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[mission.status as MissionStatus] ?? { label: mission.status, color: "text-gray-600 bg-gray-50 border-gray-200" };

  const timelineSteps: TimelineStep[] = [
    { key: "created",   label: "Mission créée",    date: mission.created_at,   done: true },
    { key: "confirmed", label: "Acceptée",          date: mission.accepted_at,  done: !!mission.accepted_at, cancelled: mission.status === "cancelled" && !mission.accepted_at },
    { key: "completed", label: "Terminée",          date: mission.completed_at, done: !!mission.completed_at },
    { key: "rated",     label: "Notée",             date: null,                 done: mission.rating_given != null },
  ];

  if (mission.status === "cancelled") {
    timelineSteps.push({
      key: "cancelled",
      label: `Annulée${mission.cancelled_reason ? ` — ${mission.cancelled_reason}` : ""}`,
      date: mission.cancelled_at,
      done: true,
      cancelled: true,
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/openers" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {TYPE_LABELS[mission.type as MissionType] ?? mission.type}
          </h1>
          <p className="text-sm text-gray-500">Planifiée le {fmt(mission.scheduled_at)}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          {/* Info */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Informations</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-gray-500">Bien</dt>
              <dd className="font-mono text-xs text-primary-600">{mission.property_id.slice(0, 8)}…</dd>
              <dt className="text-gray-500">Demandeur</dt>
              <dd className="font-mono text-xs">{mission.requester_id.slice(0, 8)}…</dd>
              {mission.opener_id && (
                <>
                  <dt className="text-gray-500">Ouvreur</dt>
                  <dd className="font-mono text-xs">{mission.opener_id.slice(0, 8)}…</dd>
                </>
              )}
              <dt className="text-gray-500">Prix</dt>
              <dd className="font-semibold">{mission.price != null ? `${mission.price} €` : "—"}</dd>
            </dl>
            {mission.notes && (
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{mission.notes}</p>
              </div>
            )}
            {mission.property_lat != null && mission.property_lng != null && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="h-3.5 w-3.5" />
                {mission.property_lat.toFixed(5)}, {mission.property_lng.toFixed(5)}
              </div>
            )}
          </div>

          {/* Report */}
          {mission.report_text && (
            <div className="card space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <FileText className="h-4 w-4" /> Rapport
              </h2>
              <p className="text-sm text-gray-700 whitespace-pre-line">{mission.report_text}</p>
              {mission.report_url && (
                <a href={mission.report_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline">
                  Télécharger le rapport
                </a>
              )}
            </div>
          )}

          {/* Photos */}
          {mission.photos_urls && mission.photos_urls.length > 0 && (
            <div className="card space-y-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <Camera className="h-4 w-4" /> Photos ({mission.photos_urls.length})
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {mission.photos_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="aspect-square w-full rounded-lg object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Rating given */}
          {mission.rating_given != null && (
            <div className="card space-y-1">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> Note
              </h2>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <span key={v} className={`text-lg ${v <= mission.rating_given! ? "text-amber-400" : "text-gray-200"}`}>★</span>
                ))}
                <span className="ml-1 text-sm font-medium text-gray-700">{mission.rating_given}/5</span>
              </div>
              {mission.rating_comment && (
                <p className="text-sm text-gray-600 italic">"{mission.rating_comment}"</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Actions</h2>

            {/* Accept (opener) */}
            {mission.status === "pending" && mission.opener_id && (
              <button
                onClick={() => accept.mutate(mission.id)}
                disabled={accept.isPending}
                className="btn-primary flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                {accept.isPending ? "Acceptation…" : "Accepter la mission"}
              </button>
            )}

            {/* Complete (opener) */}
            {(mission.status === "confirmed" || mission.status === "in_progress") && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 font-medium">Terminer la mission</p>
                <CompleteForm missionId={mission.id} />
              </div>
            )}

            {/* Rate (requester) */}
            {mission.status === "completed" && mission.rating_given == null && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 font-medium">Évaluer l&apos;ouvreur</p>
                <RateForm missionId={mission.id} />
              </div>
            )}

            {/* Cancel */}
            {(mission.status === "pending" || mission.status === "confirmed") && (
              <button
                onClick={() => cancel.mutate({ id: mission.id }, { onSuccess: () => router.push("/openers") })}
                disabled={cancel.isPending}
                className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                {cancel.isPending ? "Annulation…" : "Annuler la mission"}
              </button>
            )}
          </div>
        </div>

        {/* Right column — Timeline */}
        <div>
          <div className="card">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">Chronologie</h2>
            <MissionTimeline steps={timelineSteps} />
          </div>
        </div>
      </div>
    </div>
  );
}
