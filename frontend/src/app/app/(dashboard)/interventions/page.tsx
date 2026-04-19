"use client";

import { useState } from "react";
import {
  MapPin, Star, Clock, CheckCircle2, XCircle, Plus, Loader2,
  Wrench, Users, ChevronRight, AlertTriangle, Sparkles, FileText,
  Check,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRole } from "@/lib/hooks/useRole";
import type { RFQStatus } from "@/lib/types";
import { useRFQs } from "@/lib/hooks/useRFQ";
import Link from "next/link";
import { C } from "@/lib/design-tokens";

type Tab = "artisans" | "openers";

const MISSION_TYPE_LABELS: Record<string, string> = {
  visite: "Visite",
  edl_entree: "EDL entrée",
  edl_sortie: "EDL sortie",
  remise_cles: "Remise clés",
  expertise: "Expertise",
};

const STATUT_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  proposee:  { label: "Proposée",  bg: C.blueBg,   color: C.blue },
  acceptee:  { label: "Acceptée",  bg: C.amberBg,  color: C.amber },
  effectuee: { label: "Effectuée", bg: C.greenBg,  color: C.green },
  annulee:   { label: "Annulée",   bg: C.redBg,    color: C.red },
};

// ── Opener Mission Card ───────────────────────────────────────────────────────

interface MissionOuvreur {
  id: string;
  type: string;
  date_mission: string | null;
  remuneration: number | null;
  statut: string;
  rayon_km: number;
  instructions: string | null;
  ouvreur_id: string | null;
  note_ouvreur: number | null;
}

function MissionCard({
  mission,
  isOpener,
  onAccept,
  onRefuse,
  accepting,
  refusing,
}: {
  mission: MissionOuvreur;
  isOpener: boolean;
  onAccept: (id: string) => void;
  onRefuse: (id: string) => void;
  accepting: boolean;
  refusing: boolean;
}) {
  const cfg = STATUT_CONFIG[mission.statut] ?? STATUT_CONFIG.proposee;
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 20, boxShadow: C.shadow,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>
              {MISSION_TYPE_LABELS[mission.type] ?? mission.type}
            </span>
            <span style={{
              padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: cfg.bg, color: cfg.color,
            }}>
              {cfg.label}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "4px 16px", fontSize: 13, color: C.text3 }}>
            {mission.date_mission && (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={12} /> {new Date(mission.date_mission).toLocaleDateString("fr-CH")}
              </span>
            )}
            {mission.remuneration && (
              <span style={{ fontWeight: 600, color: C.orange }}>CHF {mission.remuneration}</span>
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <MapPin size={12} /> {mission.rayon_km} km
            </span>
          </div>
          {mission.instructions && (
            <p style={{ marginTop: 8, fontSize: 12, color: C.text3, lineHeight: 1.5 }}>
              {mission.instructions}
            </p>
          )}
          {mission.note_ouvreur != null && (
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
              {[1,2,3,4,5].map(i => (
                <Star key={i} size={12}
                  fill={i <= mission.note_ouvreur! ? C.amber : "none"}
                  color={C.amber}
                />
              ))}
            </div>
          )}
        </div>

        {/* 1-tap Accept / Refuse for opener */}
        {isOpener && mission.statut === "proposee" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => onAccept(mission.id)}
              disabled={accepting}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: C.green, color: "#fff",
                fontSize: 13, fontWeight: 600, cursor: accepting ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {accepting
                ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                : <Check size={13} />}
              Accepter
            </button>
            <button
              onClick={() => onRefuse(mission.id)}
              disabled={refusing}
              style={{
                padding: "8px 16px", borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.surface, color: C.text3,
                fontSize: 13, fontWeight: 500, cursor: refusing ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {refusing
                ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                : <XCircle size={13} />}
              Refuser
            </button>
          </div>
        )}

        {!isOpener && mission.statut === "effectuee" && (
          <CheckCircle2 size={18} color={C.green} />
        )}
      </div>
    </div>
  );
}

// ── Opener Tab ────────────────────────────────────────────────────────────────

function OpenerTab() {
  const { can } = useRole();
  const isOpener = can("opener");
  const qc = useQueryClient();
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingType, setActingType] = useState<"accept" | "refuse" | null>(null);

  const endpoint = isOpener
    ? "/ouvreurs/missions/near-me"
    : "/ouvreurs/missions?page=1&size=30";

  const { data: missions = [], isLoading } = useQuery<MissionOuvreur[]>({
    queryKey: ["missions-ouvreurs", isOpener ? "near-me" : "all"],
    queryFn: () => api.get(endpoint).then(r => r.data),
    staleTime: 30_000,
  });

  const accept = useMutation({
    mutationFn: (id: string) => api.post(`/ouvreurs/missions/${id}/accept`),
    onMutate: (id) => { setActingId(id); setActingType("accept"); },
    onSettled: () => {
      setActingId(null); setActingType(null);
      qc.invalidateQueries({ queryKey: ["missions-ouvreurs"] });
    },
  });

  const refuse = useMutation({
    mutationFn: (id: string) => api.post(`/ouvreurs/missions/${id}/refuse`, { raison: null }),
    onMutate: (id) => { setActingId(id); setActingType("refuse"); },
    onSettled: () => {
      setActingId(null); setActingType(null);
      qc.invalidateQueries({ queryKey: ["missions-ouvreurs"] });
    },
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 14, color: C.text3 }}>
          {isOpener
            ? "Missions disponibles dans votre rayon d'intervention"
            : "Missions ouvreurs pour vos biens"}
        </p>
        {!isOpener && (
          <Link
            href="/app/artisans/devis"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 8,
              background: C.orange, color: "#fff",
              fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}
          >
            <Plus size={14} /> Nouvelle mission
          </Link>
        )}
      </div>

      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 size={24} style={{ color: C.orange, animation: "spin 1s linear infinite" }} />
        </div>
      )}

      {!isLoading && missions.length === 0 && (
        <div style={{
          textAlign: "center", padding: "48px 24px",
          border: `2px dashed ${C.border}`, borderRadius: 16,
        }}>
          <Users size={36} style={{ color: C.text3, margin: "0 auto 12px" }} />
          <p style={{ fontWeight: 600, color: C.text2, margin: "0 0 4px" }}>
            {isOpener ? "Aucune mission dans votre zone" : "Aucune mission créée"}
          </p>
          <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>
            {isOpener
              ? "Augmentez votre rayon dans votre profil"
              : "Créez votre première mission ouvreur"}
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {missions.map(m => (
          <MissionCard
            key={m.id}
            mission={m}
            isOpener={isOpener}
            onAccept={(id) => accept.mutate(id)}
            onRefuse={(id) => refuse.mutate(id)}
            accepting={actingId === m.id && actingType === "accept"}
            refusing={actingId === m.id && actingType === "refuse"}
          />
        ))}
      </div>

      {isOpener && missions.length > 0 && (
        <div style={{
          marginTop: 20, padding: "12px 16px", borderRadius: 10,
          background: C.orangeBg, border: `1px solid rgba(181,90,48,0.2)`,
          fontSize: 12, color: C.text3,
        }}>
          Commission Althy : 15 % — vous recevez 85 % de la rémunération via virement Stripe.
        </div>
      )}
    </div>
  );
}

// ── Devis Comparison Modal ────────────────────────────────────────────────────

interface CompareResult {
  rfq_id: string;
  nb_devis: number;
  rapport: string;
  recommandation: string;
  cached: boolean;
}

function CompareModal({ rfqId, onClose }: { rfqId: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<CompareResult>({
    queryKey: ["compare-devis", rfqId],
    queryFn: () => api.post(`/rfqs/${rfqId}/compare-devis`).then(r => r.data),
    staleTime: Infinity,
    retry: false,
  });

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.surface, borderRadius: 20, padding: 32,
          width: "100%", maxWidth: 640, maxHeight: "80vh",
          overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Sparkles size={20} color={C.orange} />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>
            Analyse IA des devis
          </h2>
          {data?.cached && (
            <span style={{
              marginLeft: "auto", padding: "2px 10px", borderRadius: 20,
              background: C.greenBg, color: C.green, fontSize: 11, fontWeight: 600,
            }}>
              Mis en cache
            </span>
          )}
        </div>

        {isLoading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Loader2 size={28} style={{ color: C.orange, animation: "spin 1s linear infinite", marginBottom: 12 }} />
            <p style={{ color: C.text3, fontSize: 14 }}>Althy analyse les devis…</p>
          </div>
        )}

        {error && (
          <div style={{
            padding: 16, borderRadius: 10, background: C.redBg,
            border: `1px solid ${C.red}`, color: C.red, fontSize: 13,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <AlertTriangle size={14} />
            Au moins 2 devis sont requis pour lancer la comparaison.
          </div>
        )}

        {data && (
          <>
            <div style={{
              padding: "12px 16px", borderRadius: 10, marginBottom: 20,
              background: C.orangeBg, border: `1px solid rgba(181,90,48,0.25)`,
            }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.orange }}>
                {data.recommandation}
              </p>
            </div>

            <div style={{
              fontSize: 13, color: C.text2, lineHeight: 1.7,
              whiteSpace: "pre-wrap",
            }}>
              {data.rapport}
            </div>

            <p style={{ marginTop: 16, fontSize: 11, color: C.text3 }}>
              {data.nb_devis} devis analysés · Commission Althy : 10 % sur le devis retenu
            </p>
          </>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: 20, width: "100%", padding: "10px 0",
            background: C.surface2, border: `1px solid ${C.border}`,
            borderRadius: 10, fontSize: 13, fontWeight: 600, color: C.text2, cursor: "pointer",
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

// ── Artisan / Devis Tab ───────────────────────────────────────────────────────

const RFQ_STATUS_TABS: { value: RFQStatus | ""; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "published", label: "Publiés" },
  { value: "quotes_received", label: "Devis reçus" },
  { value: "accepted", label: "Acceptés" },
  { value: "in_progress", label: "En cours" },
  { value: "completed", label: "Terminés" },
];

const RFQ_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft:           { label: "Brouillon",   bg: C.surface2, color: C.text3 },
  published:       { label: "Publié",      bg: C.blueBg,   color: C.blue },
  quotes_received: { label: "Devis reçus", bg: C.amberBg,  color: C.amber },
  accepted:        { label: "Accepté",     bg: C.orangeBg, color: C.orange },
  in_progress:     { label: "En cours",    bg: C.amberBg,  color: C.amber },
  completed:       { label: "Terminé",     bg: C.greenBg,  color: C.green },
  rated:           { label: "Noté",        bg: C.greenBg,  color: C.green },
  cancelled:       { label: "Annulé",      bg: C.redBg,    color: C.red },
};

function ArtisanTab() {
  const [rfqFilter, setRfqFilter] = useState<RFQStatus | "">("");
  const [compareRfqId, setCompareRfqId] = useState<string | null>(null);
  const { data, isLoading } = useRFQs(rfqFilter as RFQStatus | undefined);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 14, color: C.text3 }}>
          Décrivez vos travaux — Althy contacte 3-5 artisans et compare les devis
        </p>
        <Link
          href="/app/artisans/devis"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 8,
            background: C.orange, color: "#fff",
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}
        >
          <Plus size={14} /> Décrire des travaux
        </Link>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 20 }}>
        {RFQ_STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setRfqFilter(tab.value)}
            style={{
              padding: "5px 14px", borderRadius: 20, border: "none", whiteSpace: "nowrap" as const,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: rfqFilter === tab.value ? C.orange : C.surface2,
              color: rfqFilter === tab.value ? "#fff" : C.text3,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 size={24} style={{ color: C.orange, animation: "spin 1s linear infinite" }} />
        </div>
      )}

      {data?.items.length === 0 && !isLoading && (
        <div style={{
          textAlign: "center", padding: "48px 24px",
          border: `2px dashed ${C.border}`, borderRadius: 16,
        }}>
          <Wrench size={36} style={{ color: C.text3, margin: "0 auto 12px" }} />
          <p style={{ fontWeight: 600, color: C.text2, margin: "0 0 4px" }}>Aucun appel d&apos;offres</p>
          <p style={{ fontSize: 13, color: C.text3, margin: "0 0 16px" }}>
            Décrivez vos travaux et Althy contacte les artisans de la zone
          </p>
          <Link
            href="/app/artisans/devis"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 18px", borderRadius: 8,
              background: C.orange, color: "#fff",
              fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}
          >
            <Plus size={14} /> Premier appel d&apos;offres
          </Link>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data?.items.map(rfq => {
          const cfg = RFQ_STATUS_CONFIG[rfq.status] ?? RFQ_STATUS_CONFIG.draft;
          const hasMultipleQuotes = rfq.quotes.length >= 2;
          return (
            <div
              key={rfq.id}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: 20, boxShadow: C.shadow,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{rfq.title}</span>
                    <span style={{
                      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: cfg.bg, color: cfg.color,
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.text3 }}>
                    {rfq.city && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <MapPin size={11} />{rfq.city}
                      </span>
                    )}
                    <span>{new Date(rfq.created_at).toLocaleDateString("fr-CH")}</span>
                    {rfq.quotes.length > 0 && (
                      <span style={{ fontWeight: 600, color: C.orange, display: "flex", alignItems: "center", gap: 3 }}>
                        <FileText size={11} />
                        {rfq.quotes.length} devis
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  {hasMultipleQuotes && (
                    <button
                      onClick={() => setCompareRfqId(rfq.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "7px 14px", borderRadius: 8, border: "none",
                        background: `linear-gradient(135deg, ${C.orange}, #e85c2c)`,
                        color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        whiteSpace: "nowrap" as const,
                      }}
                    >
                      <Sparkles size={12} /> Comparer IA
                    </button>
                  )}
                  <Link
                    href="/app/artisans/devis"
                    style={{
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 12, color: C.text3, textDecoration: "none",
                    }}
                  >
                    Voir <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 20, padding: "12px 16px", borderRadius: 10,
        background: C.surface2, border: `1px solid ${C.border}`,
        fontSize: 12, color: C.text3,
      }}>
        Commission Althy : 10 % sur le devis accepté — déduite automatiquement via Stripe.
      </div>

      {compareRfqId && (
        <CompareModal rfqId={compareRfqId} onClose={() => setCompareRfqId(null)} />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InterventionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("artisans");

  return (
    <div style={{ padding: "32px 24px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontSize: 28, fontWeight: 700, color: C.text,
          margin: "0 0 6px", letterSpacing: "-0.02em",
        }}>
          Marketplace
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: C.text3 }}>
          Openers pour visites &amp; EDL · Artisans pour vos travaux
        </p>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 28,
        background: C.surface2, borderRadius: 12, padding: 4,
        width: "fit-content",
      }}>
        {([
          { id: "artisans" as Tab, label: "Artisans & Devis", Icon: Wrench },
          { id: "openers" as Tab, label: "Openers", Icon: Users },
        ]).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: activeTab === id ? C.orange : "transparent",
              color: activeTab === id ? "#fff" : C.text3,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {activeTab === "artisans" ? <ArtisanTab /> : <OpenerTab />}
    </div>
  );
}
