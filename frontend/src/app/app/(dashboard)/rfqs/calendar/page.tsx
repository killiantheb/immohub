"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useRFQs } from "@/lib/hooks/useRFQ";
import type { RFQ } from "@/lib/types";

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

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: "Plomberie", electricity: "Électricité", cleaning: "Nettoyage",
  painting: "Peinture", locksmith: "Serrurerie", roofing: "Toiture",
  gardening: "Jardinage", masonry: "Maçonnerie", hvac: "Climatisation",
  renovation: "Rénovation", other: "Autre",
};

const URGENCY_DOT_COLOR: Record<string, string> = {
  low: S.green,
  medium: S.blue,
  high: S.orange,
  emergency: S.red,
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  draft:       { bg: S.surface2, color: S.text3 },
  published:   { bg: S.blueBg,   color: S.blue },
  in_progress: { bg: S.amberBg,  color: S.amber },
  completed:   { bg: S.greenBg,  color: S.green },
  accepted:    { bg: S.orangeBg, color: S.orange },
};

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Monday-based weekday: Mon=0 … Sun=6
function weekdayMon(d: Date) {
  return (d.getDay() + 6) % 7;
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  const { data } = useRFQs();

  // All RFQs that have a scheduled_date — index by YYYY-MM-DD
  const byDay: Record<string, RFQ[]> = {};
  (data?.items ?? []).forEach((rfq) => {
    if (!rfq.scheduled_date) return;
    const key = rfq.scheduled_date.slice(0, 10);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(rfq);
  });

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelected(null);
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelected(null);
  }

  const totalDays = daysInMonth(year, month);
  const firstDay = weekdayMon(new Date(year, month, 1));
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedRFQs = selected ? (byDay[selected] ?? []) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/app/rfqs" style={{ color: S.text3 }}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif),'Cormorant Garamond',serif", fontWeight: 400, fontSize: 28, color: S.text }}>
            Calendrier des interventions
          </h1>
          <p style={{ fontSize: 14, color: S.text3, marginTop: 2 }}>
            {Object.values(byDay).flat().length} intervention{Object.values(byDay).flat().length !== 1 ? "s" : ""} planifiée{Object.values(byDay).flat().length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <div
          className="lg:col-span-2 rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${S.border}`, background: S.surface, boxShadow: S.shadow }}
        >
          {/* Month nav */}
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: `1px solid ${S.border}` }}
          >
            <button
              onClick={prev}
              className="rounded-lg p-1.5 transition-colors"
              style={{ color: S.text3 }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold" style={{ color: S.text }}>
              {MONTHS_FR[month]} {year}
            </h2>
            <button
              onClick={next}
              className="rounded-lg p-1.5 transition-colors"
              style={{ color: S.text3 }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Days header */}
          <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${S.border}` }}>
            {DAYS_FR.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: S.text3 }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) {
                return (
                  <div
                    key={`empty-${i}`}
                    className="h-20"
                    style={{ borderRight: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}`, background: S.bg, opacity: 0.5 }}
                  />
                );
              }
              const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const rfqs = byDay[key] ?? [];
              const isToday = key === isoDay(today);
              const isSelected = key === selected;

              return (
                <button
                  key={key}
                  onClick={() => setSelected(isSelected ? null : key)}
                  className="relative h-20 p-1.5 text-left transition-colors"
                  style={{
                    borderRight: i % 7 !== 6 ? `1px solid ${S.border}` : undefined,
                    borderBottom: `1px solid ${S.border}`,
                    background: isSelected ? S.orangeBg : S.surface,
                    boxShadow: isSelected ? `inset 0 0 0 1px ${S.orange}` : undefined,
                  }}
                >
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium"
                    style={
                      isToday
                        ? { background: S.orange, color: "#fff" }
                        : { color: S.text2 }
                    }
                  >
                    {day}
                  </span>
                  <div className="mt-0.5 flex flex-col gap-0.5 overflow-hidden">
                    {rfqs.slice(0, 2).map(rfq => (
                      <div key={rfq.id} className="flex items-center gap-1 truncate">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: URGENCY_DOT_COLOR[rfq.urgency] ?? S.text3 }}
                        />
                        <span className="text-[10px] truncate leading-tight" style={{ color: S.text2 }}>
                          {CATEGORY_LABELS[rfq.category] ?? rfq.category}
                        </span>
                      </div>
                    ))}
                    {rfqs.length > 2 && (
                      <span className="text-[9px] font-medium" style={{ color: S.orange }}>+{rfqs.length - 2}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div
          className="rounded-2xl p-5"
          style={{ border: `1px solid ${S.border}`, background: S.surface, boxShadow: S.shadow }}
        >
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <p className="text-sm" style={{ color: S.text3 }}>Cliquez sur un jour pour voir les interventions planifiées</p>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold mb-4" style={{ color: S.text }}>
                {new Date(selected + "T12:00:00").toLocaleDateString("fr-CH", {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </h3>
              {selectedRFQs.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: S.text3 }}>Aucune intervention ce jour</p>
              ) : (
                <div className="space-y-3">
                  {selectedRFQs.map(rfq => {
                    const ss = STATUS_STYLE[rfq.status] ?? STATUS_STYLE.draft;
                    return (
                      <Link
                        key={rfq.id}
                        href={`/app/rfqs/${rfq.id}`}
                        className="block rounded-xl p-3 transition-colors"
                        style={{ border: `1px solid ${S.border}`, background: S.surface }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold leading-tight line-clamp-2" style={{ color: S.text }}>
                            {rfq.title}
                          </span>
                          <span
                            className="shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{ background: ss.bg, color: ss.color }}
                          >
                            {rfq.status === "in_progress" ? "En cours" : rfq.status === "completed" ? "Terminé" : rfq.status === "accepted" ? "Accepté" : rfq.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px]" style={{ color: S.text3 }}>
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: URGENCY_DOT_COLOR[rfq.urgency] ?? S.text3 }}
                          />
                          {CATEGORY_LABELS[rfq.category] ?? rfq.category}
                          {rfq.city && <span>· {rfq.city}</span>}
                        </div>
                        {rfq.budget_max && (
                          <p className="mt-1 text-[11px] font-medium" style={{ color: S.orange }}>
                            Budget: CHF {rfq.budget_max.toLocaleString("fr-CH")}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upcoming list */}
      {Object.keys(byDay).length > 0 && (
        <div
          className="rounded-2xl p-6"
          style={{ border: `1px solid ${S.border}`, background: S.surface, boxShadow: S.shadow }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: S.text2 }}>Prochaines interventions</h2>
          <div className="space-y-2">
            {Object.entries(byDay)
              .filter(([k]) => k >= isoDay(today))
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(0, 8)
              .map(([day, rfqs]) => (
                <div key={day} className="flex items-start gap-4">
                  <div className="w-24 shrink-0 text-xs pt-0.5" style={{ color: S.text3 }}>
                    {new Date(day + "T12:00:00").toLocaleDateString("fr-CH", { day: "numeric", month: "short" })}
                  </div>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {rfqs.map(rfq => (
                      <Link
                        key={rfq.id}
                        href={`/app/rfqs/${rfq.id}`}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors"
                        style={{ background: S.surface2, border: `1px solid ${S.border}`, color: S.text2 }}
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: URGENCY_DOT_COLOR[rfq.urgency] ?? S.text3 }}
                        />
                        {rfq.title.length > 30 ? rfq.title.slice(0, 30) + "…" : rfq.title}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
