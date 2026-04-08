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

const TYPE_LABELS: Record<MissionType, string> = {
  visit: "Visite",
  check_in: "Remise de clés",
  check_out: "État des lieux sortant",
  inspection: "Inspection",
  photography: "Photographie",
  other: "Autre",
};

const STATUS_CONFIG: Record<MissionStatus, { label: string; bg: string; color: string; border: string }> = {
  pending:     { label: "En attente",   bg: "var(--althy-amber-bg)",  color: "var(--althy-amber)",  border: "var(--althy-amber)" },
  confirmed:   { label: "Confirmée",    bg: "var(--althy-blue-bg)",   color: "var(--althy-blue)",   border: "var(--althy-blue)" },
  in_progress: { label: "En cours",     bg: "var(--althy-orange-bg)", color: "var(--althy-orange)", border: "var(--althy-orange)" },
  completed:   { label: "Terminée",     bg: "var(--althy-green-bg)",  color: "var(--althy-green)",  border: "var(--althy-green)" },
  cancelled:   { label: "Annulée",      bg: "var(--althy-surface-2)", color: "var(--althy-text-3)", border: "var(--althy-border)" },
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: `1px solid var(--althy-border)`,
  borderRadius: 10,
  fontSize: 14,
  color: "var(--althy-text)",
  background: "var(--althy-surface)",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const cardStyle: React.CSSProperties = {
  background: "var(--althy-surface)",
  border: `1px solid var(--althy-border)`,
  borderRadius: 14,
  boxShadow: "var(--althy-shadow)",
  padding: 20,
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
    <ol style={{ position: "relative", marginLeft: 12, borderLeft: `1px solid ${S.border}`, listStyle: "none", padding: 0, margin: 0, paddingLeft: 24 }}>
      {steps.map((step) => (
        <li key={step.key} style={{ marginBottom: 24, position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: -36,
              top: 0,
              display: "flex",
              height: 24,
              width: 24,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: `2px solid ${step.cancelled ? S.red : step.done ? S.green : S.border}`,
              background: step.cancelled ? S.redBg : step.done ? S.greenBg : S.surface,
            }}
          >
            {step.cancelled ? (
              <XCircle className="h-3.5 w-3.5" style={{ color: S.red }} />
            ) : step.done ? (
              <CheckCircle className="h-3.5 w-3.5" style={{ color: S.green }} />
            ) : (
              <Clock className="h-3.5 w-3.5" style={{ color: S.text3 }} />
            )}
          </span>
          <p style={{ fontSize: 14, fontWeight: 500, color: step.done || step.cancelled ? S.text : S.text3 }}>
            {step.label}
          </p>
          {step.date && (
            <p style={{ fontSize: 11, color: S.text3, marginTop: 2 }}>{fmt(step.date)}</p>
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
            style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", color: v <= rating ? S.amber : S.surface2, padding: 0 }}
          >
            ★
          </button>
        ))}
        <span style={{ marginLeft: 8, fontSize: 13, color: S.text3 }}>{rating}/5</span>
      </div>
      <textarea
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ ...inputStyle, resize: "none" }}
        placeholder="Commentaire (optionnel)"
      />
      <button
        type="submit"
        disabled={rate.isPending}
        style={{
          padding: "8px 18px",
          borderRadius: 10,
          background: S.orange,
          color: "#fff",
          border: "none",
          fontSize: 13,
          fontWeight: 500,
          cursor: rate.isPending ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          opacity: rate.isPending ? 0.7 : 1,
        }}
      >
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
        style={{ ...inputStyle, resize: "none" }}
        placeholder="Rapport de mission (observations, remarques…)"
      />
      <button
        type="submit"
        disabled={complete.isPending}
        style={{
          padding: "8px 18px",
          borderRadius: 10,
          background: S.orange,
          color: "#fff",
          border: "none",
          fontSize: 13,
          fontWeight: 500,
          cursor: complete.isPending ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          opacity: complete.isPending ? 0.7 : 1,
        }}
      >
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: S.orange, borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (isError || !mission) {
    return (
      <div className="py-20 text-center" style={{ background: S.surface, borderRadius: 14, border: `1px solid ${S.border}`, color: S.text3 }}>
        Mission introuvable.{" "}
        <Link href="/app/openers" style={{ color: S.orange }}>Retour</Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[mission.status as MissionStatus] ?? { label: mission.status, bg: S.surface2, color: S.text3, border: S.border };

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
        <Link href="/app/openers" style={{ color: S.text3, display: "flex" }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontWeight: 400, fontSize: 28, color: S.text, margin: 0 }}>
            {TYPE_LABELS[mission.type as MissionType] ?? mission.type}
          </h1>
          <p style={{ fontSize: 13, color: S.text3, marginTop: 2 }}>Planifiée le {fmt(mission.scheduled_at)}</p>
        </div>
        <span style={{
          borderRadius: 999,
          border: `1px solid ${statusCfg.border}`,
          padding: "4px 12px",
          fontSize: 12,
          fontWeight: 500,
          background: statusCfg.bg,
          color: statusCfg.color,
        }}>
          {statusCfg.label}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left column */}
        <div className="md:col-span-2 space-y-6">
          {/* Info */}
          <div style={cardStyle} className="space-y-3">
            <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3, margin: 0 }}>Informations</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2" style={{ fontSize: 14 }}>
              <dt style={{ color: S.text3 }}>Bien</dt>
              <dd style={{ fontFamily: "monospace", fontSize: 12, color: S.orange }}>{mission.property_id.slice(0, 8)}…</dd>
              <dt style={{ color: S.text3 }}>Demandeur</dt>
              <dd style={{ fontFamily: "monospace", fontSize: 12, color: S.text2 }}>{mission.requester_id.slice(0, 8)}…</dd>
              {mission.opener_id && (
                <>
                  <dt style={{ color: S.text3 }}>Ouvreur</dt>
                  <dd style={{ fontFamily: "monospace", fontSize: 12, color: S.text2 }}>{mission.opener_id.slice(0, 8)}…</dd>
                </>
              )}
              <dt style={{ color: S.text3 }}>Prix</dt>
              <dd style={{ fontWeight: 600, color: S.text }}>{mission.price != null ? `${mission.price} €` : "—"}</dd>
            </dl>
            {mission.notes && (
              <div style={{ borderRadius: 10, background: S.surface2, padding: "10px 14px" }}>
                <p style={{ fontSize: 11, fontWeight: 500, color: S.text3, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</p>
                <p style={{ fontSize: 14, color: S.text2 }}>{mission.notes}</p>
              </div>
            )}
            {mission.property_lat != null && mission.property_lng != null && (
              <div className="flex items-center gap-1" style={{ fontSize: 11, color: S.text3 }}>
                <MapPin className="h-3.5 w-3.5" />
                {mission.property_lat.toFixed(5)}, {mission.property_lng.toFixed(5)}
              </div>
            )}
          </div>

          {/* Report */}
          {mission.report_text && (
            <div style={cardStyle} className="space-y-2">
              <h2 className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3, margin: 0 }}>
                <FileText className="h-4 w-4" /> Rapport
              </h2>
              <p style={{ fontSize: 14, color: S.text2, whiteSpace: "pre-line" }}>{mission.report_text}</p>
              {mission.report_url && (
                <a href={mission.report_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: S.orange, textDecoration: "none" }}>
                  Télécharger le rapport
                </a>
              )}
            </div>
          )}

          {/* Photos */}
          {mission.photos_urls && mission.photos_urls.length > 0 && (
            <div style={cardStyle} className="space-y-3">
              <h2 className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3, margin: 0 }}>
                <Camera className="h-4 w-4" /> Photos ({mission.photos_urls.length})
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {mission.photos_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="aspect-square w-full object-cover transition-opacity"
                      style={{ borderRadius: 10, opacity: 1 }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Rating given */}
          {mission.rating_given != null && (
            <div style={cardStyle} className="space-y-1">
              <h2 className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3, margin: 0 }}>
                <Star className="h-4 w-4" style={{ fill: S.amber, color: S.amber }} /> Note
              </h2>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <span key={v} style={{ fontSize: 18, color: v <= mission.rating_given! ? S.amber : S.surface2 }}>★</span>
                ))}
                <span style={{ marginLeft: 4, fontSize: 14, fontWeight: 500, color: S.text2 }}>{mission.rating_given}/5</span>
              </div>
              {mission.rating_comment && (
                <p style={{ fontSize: 14, color: S.text2, fontStyle: "italic" }}>"{mission.rating_comment}"</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={cardStyle} className="space-y-4">
            <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3, margin: 0 }}>Actions</h2>

            {/* Accept (opener) */}
            {mission.status === "pending" && mission.opener_id && (
              <button
                onClick={() => accept.mutate(mission.id)}
                disabled={accept.isPending}
                className="flex items-center gap-2"
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  background: S.orange,
                  color: "#fff",
                  border: "none",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: accept.isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  opacity: accept.isPending ? 0.7 : 1,
                }}
              >
                <CheckCircle className="h-4 w-4" />
                {accept.isPending ? "Acceptation…" : "Accepter la mission"}
              </button>
            )}

            {/* Complete (opener) */}
            {(mission.status === "confirmed" || mission.status === "in_progress") && (
              <div className="space-y-2">
                <p style={{ fontSize: 14, color: S.text2, fontWeight: 500 }}>Terminer la mission</p>
                <CompleteForm missionId={mission.id} />
              </div>
            )}

            {/* Rate (requester) */}
            {mission.status === "completed" && mission.rating_given == null && (
              <div className="space-y-2">
                <p style={{ fontSize: 14, color: S.text2, fontWeight: 500 }}>Évaluer l&apos;ouvreur</p>
                <RateForm missionId={mission.id} />
              </div>
            )}

            {/* Cancel */}
            {(mission.status === "pending" || mission.status === "confirmed") && (
              <button
                onClick={() => cancel.mutate({ id: mission.id }, { onSuccess: () => router.push("/app/openers") })}
                disabled={cancel.isPending}
                className="flex items-center gap-2"
                style={{
                  borderRadius: 10,
                  border: `1px solid ${S.red}`,
                  padding: "8px 16px",
                  fontSize: 14,
                  color: S.red,
                  background: "transparent",
                  cursor: cancel.isPending ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                  opacity: cancel.isPending ? 0.5 : 1,
                }}
              >
                <XCircle className="h-4 w-4" />
                {cancel.isPending ? "Annulation…" : "Annuler la mission"}
              </button>
            )}
          </div>
        </div>

        {/* Right column — Timeline */}
        <div>
          <div style={cardStyle}>
            <h2 style={{ marginBottom: 16, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: S.text3 }}>Chronologie</h2>
            <MissionTimeline steps={timelineSteps} />
          </div>
        </div>
      </div>
    </div>
  );
}
