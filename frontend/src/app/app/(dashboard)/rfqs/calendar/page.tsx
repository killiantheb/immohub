"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { useRFQs } from "@/lib/hooks/useRFQ";
import type { RFQ } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: "Plomberie", electricity: "Électricité", cleaning: "Nettoyage",
  painting: "Peinture", locksmith: "Serrurerie", roofing: "Toiture",
  gardening: "Jardinage", masonry: "Maçonnerie", hvac: "Climatisation",
  renovation: "Rénovation", other: "Autre",
};

const URGENCY_DOT: Record<string, string> = {
  low: "bg-green-400", medium: "bg-blue-400",
  high: "bg-orange-400", emergency: "bg-red-500",
};

const STATUS_BG: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-blue-50 text-blue-700",
  in_progress: "bg-yellow-50 text-yellow-700",
  completed: "bg-green-50 text-green-700",
  accepted: "bg-purple-50 text-purple-700",
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
        <Link href="/app/rfqs" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendrier des interventions</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {Object.values(byDay).flat().length} intervention{Object.values(byDay).flat().length !== 1 ? "s" : ""} planifiée{Object.values(byDay).flat().length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <button onClick={prev} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
              <ChevronLeft className="h-5 w-5 text-gray-500" />
            </button>
            <h2 className="text-base font-semibold text-gray-900">
              {MONTHS_FR[month]} {year}
            </h2>
            <button onClick={next} className="rounded-lg p-1.5 hover:bg-gray-100 transition-colors">
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Days header */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {DAYS_FR.map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) {
                return <div key={`empty-${i}`} className="border-r border-b border-gray-50 h-20 bg-gray-50/30" />;
              }
              const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const rfqs = byDay[key] ?? [];
              const isToday = key === isoDay(today);
              const isSelected = key === selected;

              return (
                <button
                  key={key}
                  onClick={() => setSelected(isSelected ? null : key)}
                  className={`relative border-r border-b border-gray-100 h-20 p-1.5 text-left transition-colors
                    ${isSelected ? "bg-orange-50 ring-1 ring-inset ring-orange-300" : "hover:bg-gray-50"}
                    ${i % 7 === 6 ? "border-r-0" : ""}`}
                >
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
                    ${isToday ? "bg-orange-500 text-white" : "text-gray-700"}`}>
                    {day}
                  </span>
                  <div className="mt-0.5 flex flex-col gap-0.5 overflow-hidden">
                    {rfqs.slice(0, 2).map(rfq => (
                      <div key={rfq.id} className="flex items-center gap-1 truncate">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${URGENCY_DOT[rfq.urgency] ?? "bg-gray-300"}`} />
                        <span className="text-[10px] text-gray-600 truncate leading-tight">
                          {CATEGORY_LABELS[rfq.category] ?? rfq.category}
                        </span>
                      </div>
                    ))}
                    {rfqs.length > 2 && (
                      <span className="text-[9px] text-orange-500 font-medium">+{rfqs.length - 2}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <p className="text-3xl mb-3">🗓️</p>
              <p className="text-sm text-gray-400">Cliquez sur un jour pour voir les interventions planifiées</p>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                {new Date(selected + "T12:00:00").toLocaleDateString("fr-CH", {
                  weekday: "long", day: "numeric", month: "long",
                })}
              </h3>
              {selectedRFQs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Aucune intervention ce jour</p>
              ) : (
                <div className="space-y-3">
                  {selectedRFQs.map(rfq => (
                    <Link
                      key={rfq.id}
                      href={`/app/rfqs/${rfq.id}`}
                      className="block rounded-xl border border-gray-100 p-3 hover:border-orange-200 hover:bg-orange-50/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-800 leading-tight line-clamp-2">
                          {rfq.title}
                        </span>
                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BG[rfq.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {rfq.status === "in_progress" ? "En cours" : rfq.status === "completed" ? "Terminé" : rfq.status === "accepted" ? "Accepté" : rfq.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <span className={`h-2 w-2 rounded-full ${URGENCY_DOT[rfq.urgency]}`} />
                        {CATEGORY_LABELS[rfq.category] ?? rfq.category}
                        {rfq.city && <span>· {rfq.city}</span>}
                      </div>
                      {rfq.budget_max && (
                        <p className="mt-1 text-[11px] text-orange-600 font-medium">
                          Budget: CHF {rfq.budget_max.toLocaleString("fr-CH")}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upcoming list */}
      {Object.keys(byDay).length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Prochaines interventions</h2>
          <div className="space-y-2">
            {Object.entries(byDay)
              .filter(([k]) => k >= isoDay(today))
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(0, 8)
              .map(([day, rfqs]) => (
                <div key={day} className="flex items-start gap-4">
                  <div className="w-24 shrink-0 text-xs text-gray-500 pt-0.5">
                    {new Date(day + "T12:00:00").toLocaleDateString("fr-CH", { day: "numeric", month: "short" })}
                  </div>
                  <div className="flex-1 flex flex-wrap gap-2">
                    {rfqs.map(rfq => (
                      <Link
                        key={rfq.id}
                        href={`/app/rfqs/${rfq.id}`}
                        className="flex items-center gap-1.5 rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1 text-xs text-gray-700 hover:border-orange-200 hover:bg-orange-50 transition-colors"
                      >
                        <span className={`h-2 w-2 rounded-full ${URGENCY_DOT[rfq.urgency]}`} />
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
