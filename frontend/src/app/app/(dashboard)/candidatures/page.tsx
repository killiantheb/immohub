"use client";

/**
 * /app/candidatures — Tableau de bord "Candidatures reçues" (proprio / agence).
 * Affiche toutes les candidatures sur les biens du proprio connecté,
 * triées par score IA décroissant.
 */

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { C } from "@/lib/design-tokens";
import { Analytics } from "@/lib/analytics";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface Candidat {
  id: string;
  email: string;
  prenom: string | null;
  nom: string | null;
}

interface Candidature {
  id: string;
  listing_id: string;
  user_id: string;
  statut: "en_attente" | "acceptee" | "refusee" | "retiree";
  documents: Array<{ type: string; url: string; nom: string }>;
  message: string | null;
  score_ia: number | null;
  score_details: {
    recommendation: "approve" | "review" | "reject";
    risk_flags: string[];
    summary: string;
  } | null;
  frais_payes: boolean;
  owner_fee_amount: number | null;
  owner_fee_paid_at: string | null;
  owner_fee_failure_reason: string | null;
  visite_proposee_at: string | null;
  created_at: string;
  candidat?: Candidat;
  bien?: {
    id: string;
    titre: string;
    ville: string;
    prix: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUT_CONFIG = {
  en_attente: { label: "En attente", color: "var(--althy-amber)", bg: "var(--althy-amber-bg)" },
  acceptee:   { label: "Acceptée",   color: "var(--althy-green)", bg: "var(--althy-green-bg)" },
  refusee:    { label: "Refusée",    color: "var(--althy-red)",   bg: "var(--althy-red-bg)" },
  retiree:    { label: "Retirée",    color: "var(--althy-text-3)", bg: "var(--althy-surface-2)" },
};

const SCORE_COLOR = (s: number | null) => {
  if (s === null) return "var(--althy-text-3)";
  if (s >= 70) return "var(--althy-green)";
  if (s >= 50) return "var(--althy-amber)";
  return "var(--althy-red)";
};

const DOC_TYPE_LABELS: Record<string, string> = {
  cni: "CNI",
  fiche_salaire: "Fiche salaire",
  reference: "Référence",
  autre: "Autre",
};

function ScoreBadge({ score }: { score: number | null }) {
  const color = SCORE_COLOR(score);
  return (
    <div style={{
      width: 48, height: 48, borderRadius: "50%",
      border: `3px solid ${color}`, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color, lineHeight: 1 }}>
        {score !== null ? score : "—"}
      </span>
      {score !== null && <span style={{ fontSize: 9, color, lineHeight: 1 }}>/100</span>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CandidaturesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("tous");
  const [selected, setSelected] = useState<Candidature | null>(null);
  const [processing, setProcessing] = useState(false);
  const [total, setTotal] = useState(0);
  const [confirmAcceptId, setConfirmAcceptId] = useState<string | null>(null);
  const OWNER_FEE_CHF = 45;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setToken(data.session.access_token);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({ size: "50" });
    if (filter !== "tous") params.set("statut", filter);

    fetch(`${API}/marketplace/candidatures?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setCandidatures(d.items ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, filter]);

  const handleDecision = async (candidatureId: string, statut: "acceptee" | "refusee") => {
    if (!token) return;
    setProcessing(true);
    try {
      const res = await fetch(`${API}/marketplace/candidature/${candidatureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ statut }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setCandidatures((prev) =>
        prev.map((c) => (c.id === candidatureId ? { ...c, ...updated } : c))
      );
      if (selected?.id === candidatureId) setSelected((prev) => prev ? { ...prev, ...updated } : null);
      if (statut === "acceptee") {
        Analytics.tenantDossierAccepted(candidatureId);
        const fee = updated?.owner_fee;
        if (fee?.charged) Analytics.ownerFeeCharged(candidatureId, fee.amount_chf ?? OWNER_FEE_CHF);
        else if (fee) Analytics.ownerFeeFailed(candidatureId, fee.reason ?? "unknown");
      }
    } catch {
    } finally {
      setProcessing(false);
      setConfirmAcceptId(null);
    }
  };

  const TABS = [
    { key: "tous", label: "Toutes" },
    { key: "en_attente", label: "En attente" },
    { key: "acceptee", label: "Acceptées" },
    { key: "refusee", label: "Refusées" },
  ];

  
  return (
    <div style={{ padding: "24px 20px 60px", maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ font: "300 26px/1.2 var(--font-serif)", color: C.text, margin: 0 }}>
          Candidatures reçues
        </h1>
        <p style={{ fontSize: 14, color: C.text2, margin: "6px 0 0" }}>
          {total} candidature{total !== 1 ? "s" : ""} sur vos annonces, triées par score IA
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "10px 18px", fontSize: 14, fontWeight: filter === t.key ? 700 : 500,
              color: filter === t.key ? C.orange : C.text3,
              borderBottom: `2px solid ${filter === t.key ? C.orange : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTopColor: C.orange, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : candidatures.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: C.text2 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Aucune candidature</div>
          <div style={{ fontSize: 14 }}>
            {filter === "tous"
              ? "Publiez des annonces pour recevoir des candidatures."
              : `Aucune candidature avec le statut "${STATUT_CONFIG[filter as keyof typeof STATUT_CONFIG]?.label}".`}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 20 }}>
          {/* Liste */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {candidatures.map((c) => {
              const cfg = STATUT_CONFIG[c.statut] ?? STATUT_CONFIG.en_attente;
              const isSelected = selected?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelected(isSelected ? null : c)}
                  style={{
                    background: C.surface,
                    border: `1px solid ${isSelected ? C.orange : C.border}`,
                    borderRadius: C.radiusCard, padding: "14px 16px",
                    cursor: "pointer", display: "flex", gap: 14, alignItems: "center",
                    transition: "border-color 0.15s",
                  }}
                >
                  <ScoreBadge score={c.score_ia} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
                        {c.candidat?.prenom ?? "Candidat"} {c.candidat?.nom ?? ""}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                        background: cfg.bg, color: cfg.color,
                      }}>{cfg.label}</span>
                      {c.owner_fee_paid_at && (
                        <span style={{ fontSize: 11, color: "var(--althy-green)", fontWeight: 600 }}>✓ CHF {c.owner_fee_amount ?? OWNER_FEE_CHF} prélevés</span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: C.text2 }}>
                      {c.candidat?.email} · {c.documents.length} document{c.documents.length !== 1 ? "s" : ""}
                    </div>
                    {c.score_details?.summary && (
                      <div style={{ fontSize: 12, color: C.text3, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.score_details.summary}
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: C.text3, flexShrink: 0 }}>
                    {new Date(c.created_at).toLocaleDateString("fr-CH")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: C.radiusCard, padding: 20, position: "sticky", top: 80,
              alignSelf: "start", maxHeight: "calc(100vh - 120px)", overflowY: "auto",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.text }}>
                  Détail de la candidature
                </h3>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.text3, fontSize: 18 }}>✕</button>
              </div>

              {/* Score */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <ScoreBadge score={selected.score_ia} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                    Score IA : {selected.score_ia ?? "Non disponible"}{selected.score_ia ? "/100" : ""}
                  </div>
                  {selected.score_details?.recommendation && (
                    <div style={{
                      fontSize: 12,
                      color: selected.score_details.recommendation === "approve" ? "var(--althy-green)"
                        : selected.score_details.recommendation === "reject" ? "var(--althy-red)" : "var(--althy-amber)",
                    }}>
                      {selected.score_details.recommendation === "approve" ? "Dossier recommandé"
                        : selected.score_details.recommendation === "reject" ? "Dossier risqué"
                        : "Vérification conseillée"}
                    </div>
                  )}
                </div>
              </div>

              {/* Summary */}
              {selected.score_details?.summary && (
                <div style={{
                  background: "var(--cream)", borderRadius: 8, padding: "10px 12px",
                  fontSize: 13, color: C.text2, marginBottom: 16,
                }}>
                  {selected.score_details.summary}
                </div>
              )}

              {/* Risk flags */}
              {(selected.score_details?.risk_flags?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 6 }}>Points de vigilance</div>
                  {selected.score_details!.risk_flags.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#78350f", padding: "2px 0" }}>• {f}</div>
                  ))}
                </div>
              )}

              {/* Documents */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  Documents ({selected.documents.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {selected.documents.map((doc, i) => (
                    <a
                      key={i}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        background: "var(--cream)", borderRadius: 6, padding: "8px 10px",
                        textDecoration: "none", color: C.text,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>📄</span>
                      <span style={{ flex: 1, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.nom}</span>
                      <span style={{ fontSize: 11, background: "var(--althy-orange-bg)", color: "var(--terracotta-primary)", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>
                        {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                      </span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Message */}
              {selected.message && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>Message</div>
                  <div style={{
                    background: "var(--cream)", borderRadius: 8, padding: "10px 12px",
                    fontSize: 13, color: C.text2, fontStyle: "italic",
                  }}>
                    "{selected.message}"
                  </div>
                </div>
              )}

              {/* Actions */}
              {selected.statut === "en_attente" && (
                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                  <button
                    onClick={() => handleDecision(selected.id, "refusee")}
                    disabled={processing}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 8,
                      border: "1.5px solid var(--althy-red-bg)", background: "var(--althy-red-bg)",
                      color: "var(--althy-red)", fontSize: 14, fontWeight: 600,
                      cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.6 : 1,
                    }}
                  >
                    Refuser
                  </button>
                  <button
                    onClick={() => setConfirmAcceptId(selected.id)}
                    disabled={processing}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 8,
                      background: "var(--althy-green)", border: "none",
                      color: "#fff", fontSize: 14, fontWeight: 600,
                      cursor: processing ? "not-allowed" : "pointer", opacity: processing ? 0.6 : 1,
                    }}
                  >
                    Accepter ✓
                  </button>
                </div>
              )}

              {selected.statut === "acceptee" && selected.owner_fee_paid_at && (
                <div style={{
                  background: "var(--althy-green-bg)", border: "1px solid var(--althy-green)",
                  borderRadius: 8, padding: "12px 14px", marginTop: 16,
                  fontSize: 13, color: "var(--althy-green)",
                }}>
                  ✓ Candidature acceptée. CHF {selected.owner_fee_amount ?? OWNER_FEE_CHF} prélevés (frais de dossier Althy).
                </div>
              )}

              {selected.statut === "acceptee" && !selected.owner_fee_paid_at && selected.owner_fee_failure_reason && (
                <div style={{
                  background: "var(--althy-amber-bg)", border: "1px solid var(--althy-amber)",
                  borderRadius: 8, padding: "12px 14px", marginTop: 16,
                  fontSize: 13, color: "var(--althy-amber)",
                }}>
                  ⚠ Candidature acceptée, mais le prélèvement CHF {OWNER_FEE_CHF} a échoué : {selected.owner_fee_failure_reason}.
                  <div style={{ marginTop: 6 }}>
                    <Link href="/app/settings/paiement" style={{ color: "var(--althy-amber)", textDecoration: "underline", fontWeight: 600 }}>
                      Mettre à jour ma carte
                    </Link>
                  </div>
                </div>
              )}

              {selected.statut === "acceptee" && !selected.owner_fee_paid_at && !selected.owner_fee_failure_reason && (
                <div style={{
                  background: "var(--althy-green-bg)", border: "1px solid var(--althy-green)",
                  borderRadius: 8, padding: "12px 14px", marginTop: 16,
                  fontSize: 13, color: "var(--althy-green)",
                }}>
                  ✓ Candidature acceptée — prélèvement CHF {OWNER_FEE_CHF} en cours.
                </div>
              )}

              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>
      )}

      {/* ─── Modal confirmation acceptation (charge CHF 45 owner) ─────────── */}
      {confirmAcceptId && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !processing && setConfirmAcceptId(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 100, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.surface, borderRadius: 14, padding: 24, maxWidth: 460,
              width: "100%", boxShadow: "0 20px 60px rgba(15, 23, 42, 0.25)",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: C.text }}>
              Confirmer l'acceptation
            </h3>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: C.text2, lineHeight: 1.5 }}>
              En acceptant ce candidat, vous serez facturé <strong>CHF {OWNER_FEE_CHF}</strong> sur
              votre carte enregistrée — frais de dossier Althy (vérification documents + scoring IA).
            </p>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: C.text3, lineHeight: 1.5 }}>
              Le locataire ne paie rien. Si le prélèvement échoue, la candidature restera acceptée
              et vous pourrez mettre à jour votre carte ensuite.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setConfirmAcceptId(null)}
                disabled={processing}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: `1px solid ${C.border}`,
                  background: C.surface, color: C.text2, fontSize: 14, fontWeight: 500,
                  cursor: processing ? "not-allowed" : "pointer",
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => handleDecision(confirmAcceptId, "acceptee")}
                disabled={processing}
                style={{
                  padding: "10px 18px", borderRadius: 8, border: "none",
                  background: "var(--althy-green)", color: "#fff", fontSize: 14, fontWeight: 600,
                  cursor: processing ? "not-allowed" : "pointer",
                  opacity: processing ? 0.6 : 1,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {processing && (
                  <span style={{
                    display: "inline-block", width: 14, height: 14,
                    border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff",
                    borderRadius: "50%", animation: "spin 0.8s linear infinite",
                  }} />
                )}
                Accepter et payer CHF {OWNER_FEE_CHF}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
