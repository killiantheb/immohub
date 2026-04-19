"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Building2, CheckCircle2, Download,
  Eye, FileText, Shield, TrendingUp, User, XCircle,
} from "lucide-react";
import {
  useBien, useDossierLocataire, useDocuments, useScoring,
  type Locataire,
} from "@/lib/hooks/useBiens";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" });
}
function fmtCHF(n?: number | null) {
  if (n == null) return "—";
  return `CHF ${Number(n).toLocaleString("fr-CH")}`;
}

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, color, background: bg, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, boxShadow: C.shadow, padding: "1.25rem", ...style }}>
      {children}
    </div>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "1rem" }}>
      {children}
    </p>
  );
}
function Row({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.text3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: accent ? 700 : 500, color: accent ? C.text : C.text2, textAlign: "right" }}>{value}</span>
    </div>
  );
}
function Skel({ h = 16, w = "100%" }: { h?: number; w?: string | number }) {
  return <div style={{ height: h, width: w, borderRadius: 6, background: C.border, opacity: 0.6 }} />;
}
function Empty({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "3rem 1rem", color: C.text3 }}>
      <Icon size={34} style={{ margin: "0 auto 0.75rem", opacity: 0.35 }} />
      <p style={{ fontWeight: 600, color: C.text2, marginBottom: 4 }}>{title}</p>
      {sub && <p style={{ fontSize: 13 }}>{sub}</p>}
    </div>
  );
}
function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 10) * 100);
  const color = value >= 7 ? C.green : value >= 5 ? C.amber : C.red;
  return (
    <div style={{ marginBottom: "0.65rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: C.text2 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value.toFixed(1)}/10</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: C.border }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: color, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

// ── Load locataire (since we don't have a direct hook) ────────────────────────
function useLocataire(locataireId: string) {
  return useQuery({
    queryKey: ["locataires", locataireId],
    queryFn: async () => {
      const { data } = await api.get<Locataire>(`/locataires/${locataireId}`);
      return data;
    },
    enabled: Boolean(locataireId),
    staleTime: 30_000,
  });
}

const DOC_LABELS: Record<string, string> = {
  bail: "Bail", edl_entree: "EDL entrée", edl_sortie: "EDL sortie",
  quittance: "Quittance", attestation_assurance: "Attestation assurance",
  contrat_travail: "Contrat de travail", fiche_salaire: "Fiche de salaire",
  extrait_poursuites: "Extrait de poursuites", attestation_caution: "Att. caution", autre: "Autre",
};
const CAUTION_LABELS: Record<string, string> = {
  cash: "Espèces (dépôt direct)", compte_bloque: "Compte bloqué bancaire", organisme: "Organisme de caution",
};
const CONTRAT_LABELS: Record<string, string> = {
  cdi: "CDI", cdd: "CDD", independant: "Indépendant", retraite: "Retraité", autre: "Autre",
};

// ══════════════════════════════════════════════════════════════════════════════
// Onglet 1 — Identité + Scoring
// ══════════════════════════════════════════════════════════════════════════════
function TabIdentite({ locataireId }: { locataireId: string }) {
  const { data: loc, isLoading } = useLocataire(locataireId);
  const { data: scoring, isLoading: loadScore } = useScoring(locataireId);
  if (isLoading) return <Card><Skel h={200} /></Card>;
  if (!loc) return <Empty icon={User} title="Locataire introuvable" />;
  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}>
      {/* Identité */}
      <Card>
        <SectionTitle>Identité & bail</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: C.orange }}>
            L
          </div>
          <div>
            <p style={{ fontWeight: 700, color: C.text }}>Locataire #{loc.id.slice(0, 8)}</p>
            <Badge label={loc.statut === "actif" ? "Actif" : "Sorti"} color={loc.statut === "actif" ? C.green : C.text2} bg={loc.statut === "actif" ? C.greenBg : C.border} />
          </div>
        </div>
        <Row label="Entrée" value={fmtDate(loc.date_entree)} accent />
        <Row label="Sortie" value={fmtDate(loc.date_sortie)} />
        <Row label="Loyer mensuel" value={fmtCHF(loc.loyer)} accent />
        <Row label="Charges" value={fmtCHF(loc.charges)} />
        <Row label="Dépôt garantie" value={fmtCHF(loc.depot_garantie)} accent />
        {loc.motif_depart && <Row label="Motif de départ" value={loc.motif_depart} />}
        {loc.note_interne && (
          <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}` }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.text3, marginBottom: 4 }}>NOTE INTERNE</p>
            <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.5 }}>{loc.note_interne}</p>
          </div>
        )}
      </Card>

      {/* Scoring */}
      <Card>
        <SectionTitle>Scoring IA</SectionTitle>
        {loadScore ? <Skel h={160} /> : scoring ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: "1.25rem" }}>
              <div style={{
                width: 60, height: 60, borderRadius: "50%",
                background: scoring.score_global >= 7 ? C.greenBg : scoring.score_global >= 5 ? C.amberBg : C.redBg,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: scoring.score_global >= 7 ? C.green : scoring.score_global >= 5 ? C.amber : C.red }}>
                  {scoring.score_global.toFixed(1)}
                </span>
                <span style={{ fontSize: 10, color: C.text3 }}>/10</span>
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: 15, color: C.text }}>Score global</p>
                <p style={{ fontSize: 12, color: C.text3 }}>{scoring.nb_retards} retard{scoring.nb_retards !== 1 ? "s" : ""}</p>
                {scoring.updated_at && <p style={{ fontSize: 11, color: C.text3 }}>Mis à jour {fmtDate(scoring.updated_at)}</p>}
              </div>
            </div>
            <ScoreBar label="Ponctualité paiements" value={scoring.ponctualite} />
            <ScoreBar label="Solvabilité" value={scoring.solvabilite} />
            <ScoreBar label="Communication" value={scoring.communication} />
            <ScoreBar label="État du logement" value={scoring.etat_logement} />
          </>
        ) : (
          <Empty icon={TrendingUp} title="Pas de scoring" sub="Aucune donnée disponible." />
        )}
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Onglet 2 — Caution
// ══════════════════════════════════════════════════════════════════════════════
function TabCaution({ locataireId }: { locataireId: string }) {
  const { data: loc, isLoading } = useLocataire(locataireId);
  if (isLoading) return <Card><Skel h={200} /></Card>;
  if (!loc) return <Empty icon={Shield} title="Données indisponibles" />;
  const hasCaution = Boolean(loc.type_caution);
  return (
    <div style={{ maxWidth: 540 }}>
      <Card>
        <SectionTitle>Informations de caution</SectionTitle>
        {!hasCaution ? (
          <Empty icon={Shield} title="Aucune caution enregistrée" sub="Ce locataire n'a pas de caution associée." />
        ) : (
          <>
            {loc.type_caution && (
              <div style={{ padding: "0.9rem", borderRadius: 10, background: C.orangeBg, marginBottom: "1rem", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Shield size={18} style={{ color: C.orange, flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontWeight: 700, color: C.orange }}>{CAUTION_LABELS[loc.type_caution] ?? loc.type_caution}</p>
                  <p style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>Type de garantie locative</p>
                </div>
              </div>
            )}
            <Row label="Type" value={loc.type_caution ? CAUTION_LABELS[loc.type_caution] : "—"} accent />
            <Row label="Banque / Organisme" value={loc.banque_caution ?? "—"} />
            <Row label="IBAN caution" value={loc.iban_caution
              ? <span style={{ fontFamily: "monospace", fontSize: 12 }}>{loc.iban_caution}</span>
              : "—"} />
            <Row label="Montant DG" value={fmtCHF(loc.depot_garantie)} accent />

            {loc.type_caution === "compte_bloque" && (
              <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: 10, background: C.blueBg, border: `1px solid ${C.blue}22` }}>
                <p style={{ fontSize: 12, color: C.blue, lineHeight: 1.5 }}>
                  <strong>Compte bloqué:</strong> Les fonds sont déposés sur un compte bancaire bloqué au nom du locataire. Ils sont libérés à la fin du bail sous conditions.
                </p>
              </div>
            )}
            {loc.type_caution === "organisme" && (
              <div style={{ marginTop: "1rem", padding: "0.75rem", borderRadius: 10, background: C.greenBg, border: `1px solid ${C.green}22` }}>
                <p style={{ fontSize: 12, color: C.green, lineHeight: 1.5 }}>
                  <strong>Organisme de caution:</strong> Un tiers (ex. ACOSS, garantie cantonale) se porte garant. Vérifiez la validité auprès de l&apos;organisme.
                </p>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Onglet 3 — Assurance
// ══════════════════════════════════════════════════════════════════════════════
function TabAssurance({ locataireId }: { locataireId: string }) {
  const { data: dossier, isLoading } = useDossierLocataire(locataireId);
  if (isLoading) return <Card><Skel h={200} /></Card>;
  const expiry = dossier?.validite_assurance;
  const daysLeft = expiry
    ? Math.round((new Date(expiry).getTime() - Date.now()) / 86_400_000)
    : null;
  const expired = daysLeft !== null && daysLeft < 0;
  const expireSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
  return (
    <div style={{ maxWidth: 540 }}>
      <Card>
        <SectionTitle>Assurance responsabilité civile</SectionTitle>
        {!dossier ? (
          <Empty icon={Shield} title="Aucun dossier" sub="Créez le dossier locataire pour renseigner l'assurance." />
        ) : (
          <>
            {/* Status banner */}
            {expired && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: 10, background: C.redBg, border: `1px solid ${C.red}22`, display: "flex", gap: 8, alignItems: "flex-start", marginBottom: "1rem" }}>
                <XCircle size={16} style={{ color: C.red, flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: C.red }}>Assurance <strong>expirée</strong>. Demandez une attestation renouvelée au locataire.</p>
              </div>
            )}
            {expireSoon && !expired && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: 10, background: C.amberBg, border: `1px solid ${C.amber}22`, display: "flex", gap: 8, alignItems: "flex-start", marginBottom: "1rem" }}>
                <AlertTriangle size={16} style={{ color: C.amber, flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: C.amber }}>Assurance expire dans <strong>{daysLeft} jours</strong>. Demandez le renouvellement.</p>
              </div>
            )}
            {!expired && !expireSoon && dossier.assureur_rc && (
              <div style={{ padding: "0.75rem 1rem", borderRadius: 10, background: C.greenBg, border: `1px solid ${C.green}22`, display: "flex", gap: 8, alignItems: "center", marginBottom: "1rem" }}>
                <CheckCircle2 size={16} style={{ color: C.green }} />
                <p style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>Assurance valide</p>
              </div>
            )}
            <Row label="Assureur" value={dossier.assureur_rc ?? "—"} accent />
            <Row label="N° de police" value={dossier.numero_police
              ? <span style={{ fontFamily: "monospace", fontSize: 12 }}>{dossier.numero_police}</span>
              : "—"} />
            <Row label="Couverture" value="Responsabilité civile privée" />
            <Row label="Validité" value={
              <span style={{ color: expired ? C.red : expireSoon ? C.amber : C.text }}>
                {fmtDate(expiry)}{daysLeft !== null && !expired ? ` (J−${daysLeft})` : ""}
              </span>
            } accent />
          </>
        )}
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Onglet 4 — Situation financière
// ══════════════════════════════════════════════════════════════════════════════
function TabSituationFinanciere({ locataireId, bienId }: { locataireId: string; bienId: string }) {
  const { data: dossier, isLoading } = useDossierLocataire(locataireId);
  const { data: loc } = useLocataire(locataireId);
  const { data: docs } = useDocuments(bienId, locataireId);

  const salaire = dossier?.salaire_net;
  const loyer = loc?.loyer;
  const ratioLoyer = salaire && loyer ? ((loyer / salaire) * 100).toFixed(1) : null;
  const ratioColor = ratioLoyer ? (parseFloat(ratioLoyer) <= 33 ? C.green : parseFloat(ratioLoyer) <= 40 ? C.amber : C.red) : C.text;

  const fichesDeSalaire = docs?.filter(d => d.type === "fiche_salaire") ?? [];
  const contratTravail = docs?.find(d => d.type === "contrat_travail");
  const extraitPoursuites = docs?.find(d => d.type === "extrait_poursuites");

  if (isLoading) return <Card><Skel h={300} /></Card>;
  return (
    <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}>
      {/* Emploi */}
      <Card>
        <SectionTitle>Situation professionnelle</SectionTitle>
        {!dossier ? (
          <Empty icon={Building2} title="Aucun dossier" sub="Dossier locataire non renseigné." />
        ) : (
          <>
            <Row label="Employeur" value={dossier.employeur ?? "—"} accent />
            <Row label="Poste" value={dossier.poste ?? "—"} />
            <Row label="Type contrat" value={dossier.type_contrat ? CONTRAT_LABELS[dossier.type_contrat] ?? dossier.type_contrat : "—"} />
            <Row label="Ancienneté" value={dossier.anciennete != null ? `${dossier.anciennete} mois` : "—"} />
            <Row label="Salaire net mensuel" value={<span style={{ fontWeight: 800, color: C.green }}>{fmtCHF(dossier.salaire_net)}</span>} />
            {ratioLoyer && (
              <div style={{ marginTop: "1rem", padding: "0.9rem", borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 11, color: C.text3, marginBottom: 6 }}>RATIO LOYER / SALAIRE</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: ratioColor }}>{ratioLoyer}%</span>
                  <div>
                    <p style={{ fontSize: 12, color: C.text2 }}>{fmtCHF(loyer)} / {fmtCHF(salaire)}</p>
                    <p style={{ fontSize: 11, color: ratioColor, fontWeight: 600 }}>
                      {parseFloat(ratioLoyer) <= 33 ? "Excellent" : parseFloat(ratioLoyer) <= 40 ? "Acceptable" : "Élevé"}
                    </p>
                  </div>
                </div>
                <div style={{ marginTop: 8, height: 6, borderRadius: 99, background: C.border }}>
                  <div style={{ height: "100%", width: `${Math.min(100, parseFloat(ratioLoyer) * 2)}%`, borderRadius: 99, background: ratioColor }} />
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Poursuites */}
      <Card>
        <SectionTitle>Extrait de poursuites</SectionTitle>
        {!dossier ? (
          <Empty icon={FileText} title="Aucun dossier" />
        ) : (
          <>
            {dossier.resultat_poursuites ? (
              <div style={{ marginBottom: "1rem", padding: "0.9rem", borderRadius: 10, background: dossier.resultat_poursuites.toLowerCase().includes("néant") || dossier.resultat_poursuites.toLowerCase() === "0" ? C.greenBg : C.redBg, border: `1px solid ${dossier.resultat_poursuites.toLowerCase().includes("néant") ? C.green : C.red}22`, display: "flex", gap: 10, alignItems: "flex-start" }}>
                {dossier.resultat_poursuites.toLowerCase().includes("néant") || dossier.resultat_poursuites === "0"
                  ? <CheckCircle2 size={18} style={{ color: C.green, flexShrink: 0 }} />
                  : <AlertTriangle size={18} style={{ color: C.red, flexShrink: 0 }} />}
                <div>
                  <p style={{ fontWeight: 700, color: C.text }}>Résultat: {dossier.resultat_poursuites}</p>
                  {dossier.date_poursuites && <p style={{ fontSize: 12, color: C.text3 }}>Daté du {fmtDate(dossier.date_poursuites)}</p>}
                  {dossier.office_poursuites && <p style={{ fontSize: 12, color: C.text3 }}>Office: {dossier.office_poursuites}</p>}
                </div>
              </div>
            ) : (
              <Empty icon={FileText} title="Aucun résultat" sub="Extrait non renseigné." />
            )}
            {extraitPoursuites && (
              <div style={{ display: "flex", gap: 8, marginTop: "0.5rem" }}>
                <a href={extraitPoursuites.url_storage} target="_blank" rel="noopener noreferrer" style={iconBtn}>
                  <Eye size={13} />
                </a>
                <a href={extraitPoursuites.url_storage} download style={iconBtn}>
                  <Download size={13} />
                </a>
              </div>
            )}
          </>
        )}

        {/* Pièces justificatives */}
        <div style={{ marginTop: "1.5rem" }}>
          <SectionTitle>Pièces jointes</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <PjRow label="Contrat de travail" doc={contratTravail} />
            {fichesDeSalaire.length === 0
              ? <PjRow label="Fiches de salaire (0/3)" doc={undefined} />
              : fichesDeSalaire.map((d, i) => <PjRow key={d.id} label={`Fiche de salaire ${i + 1}`} doc={d} />)
            }
          </div>
        </div>
      </Card>
    </div>
  );
}

function PjRow({ label, doc }: { label: string; doc?: { url_storage: string } }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <FileText size={13} style={{ color: doc ? C.orange : C.text3 }} />
        <span style={{ fontSize: 12, color: doc ? C.text : C.text3, fontWeight: doc ? 600 : 400 }}>{label}</span>
      </div>
      {doc ? (
        <div style={{ display: "flex", gap: 4 }}>
          <a href={doc.url_storage} target="_blank" rel="noopener noreferrer" style={iconBtn}><Eye size={12} /></a>
          <a href={doc.url_storage} download style={iconBtn}><Download size={12} /></a>
        </div>
      ) : (
        <span style={{ fontSize: 11, color: C.text3 }}>Manquant</span>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 26, height: 26, borderRadius: 7,
  border: `1px solid ${C.border}`, background: C.surface, color: C.text2, textDecoration: "none",
};

// ══════════════════════════════════════════════════════════════════════════════
// Onglet 5 — Documents
// ══════════════════════════════════════════════════════════════════════════════
function TabDocsDossier({ bienId, locataireId }: { bienId: string; locataireId: string }) {
  const { data: docs, isLoading } = useDocuments(bienId, locataireId);
  if (isLoading) return <Card><Skel h={200} /></Card>;
  const all = docs ?? [];
  return (
    <div>
      {!all.length ? (
        <Empty icon={FileText} title="Aucun document" sub="Aucun document lié à ce dossier." />
      ) : (
        <div style={{ display: "grid", gap: "0.65rem", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {all.map(doc => (
            <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "0.8rem 1rem", borderRadius: 12, border: `1px solid ${C.border}`, background: C.surface }}>
              <FileText size={18} style={{ color: doc.genere_par_ia ? C.orange : C.text3, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {DOC_LABELS[doc.type] ?? doc.type}
                </p>
                <p style={{ fontSize: 11, color: C.text3 }}>
                  {fmtDate(doc.date_document ?? doc.created_at)}
                  {doc.genere_par_ia && <span style={{ marginLeft: 5, color: C.orange, fontWeight: 600 }}>IA</span>}
                </p>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <a href={doc.url_storage} target="_blank" rel="noopener noreferrer" style={iconBtn}><Eye size={12} /></a>
                <a href={doc.url_storage} download style={iconBtn}><Download size={12} /></a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main page — Dossier locataire
// ══════════════════════════════════════════════════════════════════════════════
type TabId = "identite" | "caution" | "assurance" | "finances" | "documents";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "identite",   label: "Identité & scoring",    icon: User },
  { id: "caution",    label: "Caution",                icon: Shield },
  { id: "assurance",  label: "Assurance",              icon: CheckCircle2 },
  { id: "finances",   label: "Situation financière",   icon: TrendingUp },
  { id: "documents",  label: "Documents",              icon: FileText },
];

export default function DossierLocatairePage() {
  const { id: bienId, locataire_id } = useParams<{ id: string; locataire_id: string }>();
  const router = useRouter();
  const { data: loc } = useLocataire(locataire_id);
  const [activeTab, setActiveTab] = useState<TabId>("identite");

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      {/* Back */}
      <button
        onClick={() => router.back()}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: C.text3, fontSize: 13, cursor: "pointer", marginBottom: "1rem", padding: 0 }}
      >
        <ArrowLeft size={14} /> Retour
      </button>

      {/* Page title */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.orangeBg, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: C.orange }}>L</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text }}>
              Dossier locataire #{locataire_id.slice(0, 8)}
            </h1>
            <p style={{ fontSize: 13, color: C.text2 }}>
              {fmtDate(loc?.date_entree)} → {fmtDate(loc?.date_sortie)}
              {loc?.statut && (
                <Badge
                  label={loc.statut === "actif" ? "Actif" : "Sorti"}
                  color={loc.statut === "actif" ? C.green : C.text2}
                  bg={loc.statut === "actif" ? C.greenBg : C.border}
                />
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: "1.5rem", overflowX: "auto" }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 16px", background: "none", border: "none",
                borderBottom: `2px solid ${active ? C.orange : "transparent"}`,
                color: active ? C.orange : C.text3,
                fontWeight: active ? 700 : 500, fontSize: 13,
                cursor: "pointer", whiteSpace: "nowrap", transition: "color 0.15s",
              }}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1040 }}>
        {activeTab === "identite"  && <TabIdentite             locataireId={locataire_id} />}
        {activeTab === "caution"   && <TabCaution              locataireId={locataire_id} />}
        {activeTab === "assurance" && <TabAssurance            locataireId={locataire_id} />}
        {activeTab === "finances"  && <TabSituationFinanciere  locataireId={locataire_id} bienId={bienId} />}
        {activeTab === "documents" && <TabDocsDossier          bienId={bienId} locataireId={locataire_id} />}
      </div>
    </div>
  );
}
