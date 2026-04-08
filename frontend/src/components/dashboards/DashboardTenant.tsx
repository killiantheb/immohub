"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle2, Clock, Download, Eye,
  FileText, Home, PlusCircle, XCircle,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTenantDashboard } from "@/lib/hooks/useDashboardData";
import type { DocumentAlthy, Paiement } from "@/lib/hooks/useDashboardData";

// ── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  bg:       "var(--althy-bg)",
  surface:  "var(--althy-surface)",
  surface2: "var(--althy-surface-2)",
  border:   "var(--althy-border)",
  text:     "var(--althy-text)",
  text2:    "var(--althy-text-2)",
  text3:    "var(--althy-text-3)",
  orange:   "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg)",
  green:    "var(--althy-green)",
  greenBg:  "var(--althy-green-bg)",
  red:      "var(--althy-red)",
  redBg:    "var(--althy-red-bg)",
  amber:    "var(--althy-amber)",
  amberBg:  "var(--althy-amber-bg)",
  blue:     "var(--althy-blue)",
  blueBg:   "var(--althy-blue-bg)",
  shadow:   "var(--althy-shadow)",
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtCHF(n: number) {
  return `CHF ${n.toLocaleString("fr-CH")}`;
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" });
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: S.surface, borderRadius: 16, border: `1px solid ${S.border}`, boxShadow: S.shadow, padding: "1.25rem", ...style }}>
      {children}
    </div>
  );
}
function Skel({ h = 16, w = "100%" }: { h?: number; w?: string | number }) {
  return <div style={{ height: h, width: w, borderRadius: 8, background: S.border, opacity: 0.5 }} />;
}
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: `1px solid ${S.border}` }}>
      <span style={{ fontSize: 12, color: S.text3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{value}</span>
    </div>
  );
}

// ── Statut paiement ───────────────────────────────────────────────────────────
function PaiementStatut({ paiement }: { paiement: Paiement | null }) {
  if (!paiement) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.75rem 1rem", borderRadius: 10, background: S.amberBg, border: `1px solid ${S.amber}40` }}>
        <Clock size={16} style={{ color: S.amber, flexShrink: 0 }} />
        <p style={{ fontSize: 13, color: S.amber, fontWeight: 600 }}>Aucun paiement enregistré ce mois-ci</p>
      </div>
    );
  }
  if (paiement.statut === "recu") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.75rem 1rem", borderRadius: 10, background: S.greenBg, border: `1px solid ${S.green}40` }}>
        <CheckCircle2 size={16} style={{ color: S.green, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 13, color: S.green, fontWeight: 700 }}>Loyer payé — {fmtCHF(Number(paiement.montant))}</p>
          <p style={{ fontSize: 11, color: S.text3 }}>Reçu le {fmtDate(paiement.date_paiement)}</p>
        </div>
      </div>
    );
  }
  if (paiement.statut === "retard") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.75rem 1rem", borderRadius: 10, background: S.redBg, border: `1px solid ${S.red}40` }}>
        <XCircle size={16} style={{ color: S.red, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 13, color: S.red, fontWeight: 700 }}>Loyer en retard — {fmtCHF(Number(paiement.montant))}</p>
          <p style={{ fontSize: 11, color: S.red }}>Échéance dépassée · Contactez votre propriétaire</p>
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.75rem 1rem", borderRadius: 10, background: S.amberBg, border: `1px solid ${S.amber}40` }}>
      <Clock size={16} style={{ color: S.amber, flexShrink: 0 }} />
      <div>
        <p style={{ fontSize: 13, color: S.amber, fontWeight: 700 }}>Loyer à payer — {fmtCHF(Number(paiement.montant))}</p>
        <p style={{ fontSize: 11, color: S.text3 }}>Échéance : {fmtDate(paiement.date_echeance)}</p>
      </div>
    </div>
  );
}

// ── Signalement form ──────────────────────────────────────────────────────────
function SignalementForm({ bienId, onClose }: { bienId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [titre, setTitre] = useState("");
  const [desc, setDesc] = useState("");
  const [urgence, setUrgence] = useState<"normal" | "urgent">("normal");

  const create = useMutation({
    mutationFn: () =>
      api.post("/interventions-althy/", {
        bien_id: bienId,
        titre,
        description: desc,
        urgence,
        statut: "nouveau",
        categorie: "autre",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "tenant"] });
      onClose();
    },
  });

  return (
    <Card style={{ marginTop: "1rem" }}>
      <p style={{ fontSize: 14, fontWeight: 700, color: S.text, marginBottom: "1rem" }}>Signaler un problème</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <input
          placeholder="Titre du problème (ex: Fuite robinet cuisine)"
          value={titre}
          onChange={e => setTitre(e.target.value)}
          style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surface2, color: S.text, fontSize: 13, outline: "none" }}
        />
        <textarea
          placeholder="Description détaillée..."
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={3}
          style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surface2, color: S.text, fontSize: 13, outline: "none", resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          {(["normal", "urgent"] as const).map(u => (
            <button
              key={u}
              onClick={() => setUrgence(u)}
              style={{
                flex: 1, padding: "8px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${urgence === u ? (u === "urgent" ? S.red : S.green) : S.border}`,
                background: urgence === u ? (u === "urgent" ? S.redBg : S.greenBg) : S.surface,
                color: urgence === u ? (u === "urgent" ? S.red : S.green) : S.text3,
              }}>
              {u === "urgent" ? "🔴 Urgent" : "🟢 Normal"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => create.mutate()}
            disabled={!titre.trim() || create.isPending}
            style={{ flex: 1, padding: "10px", borderRadius: 10, background: S.orange, color: "#fff", fontSize: 13, fontWeight: 700, border: "none", cursor: titre.trim() ? "pointer" : "not-allowed", opacity: titre.trim() ? 1 : 0.5 }}>
            {create.isPending ? "Envoi…" : "Envoyer le signalement"}
          </button>
          <button
            onClick={onClose}
            style={{ padding: "10px 16px", borderRadius: 10, background: S.surface2, color: S.text3, fontSize: 13, fontWeight: 600, border: `1px solid ${S.border}`, cursor: "pointer" }}>
            Annuler
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── Document row ──────────────────────────────────────────────────────────────
const DOC_TYPE_LABELS: Record<string, string> = {
  bail: "Bail", avenant: "Avenant", etat_des_lieux: "État des lieux",
  quittance: "Quittance", attestation: "Attestation", autre: "Autre",
};

function DocRow({ doc }: { doc: DocumentAlthy }) {
  const label = `${DOC_TYPE_LABELS[doc.type] ?? doc.type}${doc.date_document ? ` — ${fmtDate(doc.date_document)}` : ""}`;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.65rem 0.85rem", borderRadius: 10, border: `1px solid ${S.border}`, background: S.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <FileText size={15} style={{ color: S.orange, flexShrink: 0 }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: S.text }}>{label}</p>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {doc.url_storage && (
          <>
            <a href={doc.url_storage} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, border: `1px solid ${S.border}`, background: S.surface2, color: S.text3, fontSize: 11, fontWeight: 600, textDecoration: "none" }}>
              <Eye size={11} /> Voir
            </a>
            <a href={doc.url_storage} download
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, border: "none", background: S.orangeBg, color: S.orange, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>
              <Download size={11} /> Télécharger
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DashboardTenant
// ══════════════════════════════════════════════════════════════════════════════
export function DashboardTenant({ firstName }: { firstName: string }) {
  const { isLoading, locataire, bien, documents, paiementMois } = useTenantDashboard();
  const [showForm, setShowForm] = useState(false);

  const bail = documents.filter(d => d.type === "bail");
  const quittances = documents.filter(d => d.type === "quittance").sort((a, b) =>
    (b.date_document ?? "").localeCompare(a.date_document ?? "")
  );
  const autres = documents.filter(d => d.type !== "bail" && d.type !== "quittance");

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: "1.75rem" }}>
        <p style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: S.text3, marginBottom: 6 }}>Locataire</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: S.text, marginBottom: 4 }}>
          Bonjour{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p style={{ fontSize: 13, color: S.text3 }}>
          {new Date().toLocaleDateString("fr-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Skel h={120} />
          <Skel h={80} />
          <Skel h={200} />
        </div>
      ) : !locataire ? (
        <Card style={{ textAlign: "center", padding: "3rem 2rem" }}>
          <Home size={40} style={{ margin: "0 auto 1rem", color: S.text3, opacity: 0.3 }} />
          <p style={{ fontWeight: 700, color: S.text2, marginBottom: 6 }}>Aucun logement associé</p>
          <p style={{ fontSize: 13, color: S.text3 }}>Votre dossier locataire n'est pas encore configuré.</p>
        </Card>
      ) : (
        <>
          {/* Logement card */}
          <Card style={{ marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: S.orangeBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Home size={18} style={{ color: S.orange }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: S.text }}>{bien?.adresse ?? "Logement"}</p>
                <p style={{ fontSize: 12, color: S.text3 }}>
                  {bien?.cp} {bien?.ville}{bien?.surface ? ` · ${bien.surface} m²` : ""}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <InfoRow label="Loyer mensuel" value={locataire.loyer ? fmtCHF(Number(locataire.loyer)) : "—"} />
              <InfoRow label="Charges" value={locataire.charges ? fmtCHF(Number(locataire.charges)) : "—"} />
              <InfoRow label="Début du bail" value={fmtDate(locataire.date_entree)} />
              {locataire.date_sortie && (
                <InfoRow
                  label="Fin du bail"
                  value={
                    <span style={{ color: S.amber }}>
                      <AlertTriangle size={11} style={{ display: "inline", marginRight: 4 }} />
                      {fmtDate(locataire.date_sortie)}
                    </span>
                  }
                />
              )}
            </div>
          </Card>

          {/* Paiement du mois */}
          <div style={{ marginBottom: "1.25rem" }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: S.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
              Loyer du mois
            </p>
            <PaiementStatut paiement={paiementMois} />
          </div>

          {/* Documents */}
          <Card style={{ marginBottom: "1.25rem" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: S.text, marginBottom: "1rem" }}>Mes documents</p>

            {/* Bail */}
            {bail.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: S.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                  Bail & avenants
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {bail.map(d => <DocRow key={d.id} doc={d} />)}
                </div>
              </div>
            )}

            {/* Quittances */}
            {quittances.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: S.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                  Quittances de loyer
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {quittances.slice(0, 6).map(d => <DocRow key={d.id} doc={d} />)}
                  {quittances.length > 6 && (
                    <Link href={`/app/biens/${locataire.bien_id}`} style={{ fontSize: 12, color: S.orange, textDecoration: "none", fontWeight: 600, padding: "0.5rem 0" }}>
                      Voir toutes les quittances ({quittances.length}) →
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Autres docs */}
            {autres.length > 0 && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: S.text3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
                  Autres documents
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {autres.map(d => <DocRow key={d.id} doc={d} />)}
                </div>
              </div>
            )}

            {documents.length === 0 && (
              <div style={{ textAlign: "center", padding: "1.5rem", color: S.text3 }}>
                <FileText size={28} style={{ margin: "0 auto 0.5rem", opacity: 0.3 }} />
                <p style={{ fontSize: 13 }}>Aucun document disponible</p>
              </div>
            )}
          </Card>

          {/* Signalement */}
          <div>
            <button
              onClick={() => setShowForm(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 20px", borderRadius: 12,
                background: showForm ? S.redBg : S.orangeBg,
                border: `1px solid ${showForm ? S.red : S.orange}40`,
                color: showForm ? S.red : S.orange,
                fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%",
                justifyContent: "center",
              }}>
              <PlusCircle size={16} />
              {showForm ? "Annuler le signalement" : "Signaler un problème"}
            </button>

            {showForm && bien && (
              <SignalementForm bienId={bien.id} onClose={() => setShowForm(false)} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
