"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  ClipboardList, Home, Key, LogIn, LogOut, Plus, Search,
  Trash2, Upload, UserCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { S, fmtDate, fmtCHF, Card, Badge } from "../_shared";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "depart_annonce" | "recherche" | "checkout" | "checkin" | "termine";

interface ChecklistItem { id: string; label: string; done: boolean }

interface Piece {
  nom: string;
  etat: "bon" | "usure_normale" | "degradation" | "";
  commentaire: string;
  photos: string[];
}

interface Edl { pieces: Piece[]; inventaire: Record<string, unknown> }

interface Changement {
  id: string;
  bien_id: string;
  phase: Phase;
  statut: "en_cours" | "termine" | "annule";
  date_depart_prevu: string | null;
  checklist_depart: ChecklistItem[];
  annonce_publiee: boolean;
  date_checkout: string | null;
  edl_sortie: Edl;
  caution_retenue: number | null;
  caution_motif: string | null;
  date_checkin: string | null;
  edl_entree: Edl;
  bail_signe: boolean;
  premier_loyer_envoye: boolean;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const PIECES_DEFAUT: Piece[] = [
  { nom: "Entrée",    etat: "", commentaire: "", photos: [] },
  { nom: "Salon",     etat: "", commentaire: "", photos: [] },
  { nom: "Cuisine",   etat: "", commentaire: "", photos: [] },
  { nom: "Chambre 1", etat: "", commentaire: "", photos: [] },
  { nom: "Salle de bain", etat: "", commentaire: "", photos: [] },
  { nom: "WC",        etat: "", commentaire: "", photos: [] },
];

const PHASES_INFO: Record<Phase | "termine", { label: string; icon: React.ElementType; color: string }> = {
  depart_annonce: { label: "Départ annoncé",       icon: LogOut,      color: S.amber },
  recherche:      { label: "Recherche locataire",  icon: Search,      color: S.blue },
  checkout:       { label: "Check-out (EDL sortie)", icon: ClipboardList, color: S.orange },
  checkin:        { label: "Check-in (EDL entrée)", icon: LogIn,       color: S.green },
  termine:        { label: "Cycle terminé",         icon: CheckCircle2, color: S.green },
};

const ETAT_OPTIONS = [
  { value: "bon",          label: "Bon état",       color: S.green },
  { value: "usure_normale", label: "Usure normale",  color: S.amber },
  { value: "degradation",  label: "Dégradation",    color: S.red },
] as const;

// ── Sous-composants ───────────────────────────────────────────────────────────

function PhaseSteps({ current }: { current: Phase }) {
  const phases: Phase[] = ["depart_annonce", "recherche", "checkout", "checkin"];
  const currentIdx = phases.indexOf(current === "termine" ? "checkin" : current);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: "2rem" }}>
      {phases.map((p, i) => {
        const info = PHASES_INFO[p];
        const done = i < currentIdx || current === "termine";
        const active = i === currentIdx && current !== "termine";
        const color = done ? S.green : active ? S.orange : S.border;

        return (
          <div key={p} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: done ? S.green : active ? S.orange : S.surface,
                  border: `2px solid ${color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: done || active ? "#fff" : S.text3,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {done
                  ? <CheckCircle2 size={16} />
                  : <info.icon size={16} />
                }
              </div>
              <span style={{
                fontSize: 11, marginTop: 4, textAlign: "center",
                color: active ? S.orange : done ? S.green : S.text3,
                fontWeight: active ? 600 : 400,
                whiteSpace: "nowrap",
              }}>
                {info.label}
              </span>
            </div>
            {i < phases.length - 1 && (
              <div style={{
                height: 2, flex: 1, marginBottom: 20,
                background: i < currentIdx ? S.green : S.border,
                minWidth: 12,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChecklistCard({ items, onToggle }: {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
}) {
  const done = items.filter(i => i.done).length;
  return (
    <Card style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontWeight: 600, color: S.text, fontSize: 14 }}>Checklist départ</span>
        <span style={{ fontSize: 12, color: S.text3 }}>{done}/{items.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map(item => (
          <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => onToggle(item.id)}
              style={{ accentColor: S.orange, width: 16, height: 16 }}
            />
            <span style={{
              fontSize: 13, color: item.done ? S.text3 : S.text,
              textDecoration: item.done ? "line-through" : "none",
            }}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
      {done === items.length && (
        <div style={{ marginTop: 12, fontSize: 12, color: S.green, fontWeight: 600 }}>
          ✓ Toutes les tâches sont effectuées
        </div>
      )}
    </Card>
  );
}

function EdlCard({
  title,
  pieces,
  onChange,
  edlRef,
}: {
  title: string;
  pieces: Piece[];
  onChange: (pieces: Piece[]) => void;
  edlRef?: Edl | null;
}) {
  const [open, setOpen] = useState<number | null>(0);

  function setPiece(idx: number, update: Partial<Piece>) {
    const next = pieces.map((p, i) => i === idx ? { ...p, ...update } : p);
    onChange(next);
  }

  return (
    <Card style={{ marginBottom: "1rem" }}>
      <div style={{ fontWeight: 600, color: S.text, fontSize: 14, marginBottom: 12 }}>{title}</div>
      {pieces.map((piece, idx) => {
        const isOpen = open === idx;
        const refPiece = edlRef?.pieces?.[idx];

        return (
          <div
            key={idx}
            style={{ borderBottom: `1px solid ${S.border}`, paddingBottom: 8, marginBottom: 8 }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : idx)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "none", border: "none", cursor: "pointer",
                padding: "6px 0", color: S.text, fontSize: 13, fontWeight: 500,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Home size={14} color={S.text3} />
                {piece.nom}
                {piece.etat && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                    background: piece.etat === "bon" ? "var(--althy-green-bg)" : piece.etat === "usure_normale" ? "var(--althy-amber-bg)" : "var(--althy-red-bg)",
                    color: piece.etat === "bon" ? S.green : piece.etat === "usure_normale" ? "var(--althy-amber)" : S.red,
                  }}>
                    {ETAT_OPTIONS.find(e => e.value === piece.etat)?.label}
                  </span>
                )}
              </span>
              {isOpen ? <ChevronUp size={14} color={S.text3} /> : <ChevronDown size={14} color={S.text3} />}
            </button>

            {isOpen && (
              <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Comparaison EDL ref */}
                {refPiece?.etat && (
                  <div style={{ fontSize: 12, color: S.text3, background: S.surface, border: `1px solid ${S.border}`, borderRadius: 6, padding: "6px 10px" }}>
                    <strong>EDL entrée :</strong> {ETAT_OPTIONS.find(e => e.value === refPiece.etat)?.label}
                    {refPiece.commentaire && <> — {refPiece.commentaire}</>}
                  </div>
                )}

                {/* État */}
                <div style={{ display: "flex", gap: 8 }}>
                  {ETAT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPiece(idx, { etat: opt.value as Piece["etat"] })}
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: 8, cursor: "pointer",
                        border: `2px solid ${piece.etat === opt.value ? opt.color : S.border}`,
                        background: piece.etat === opt.value ? (opt.value === "bon" ? "var(--althy-green-bg)" : opt.value === "usure_normale" ? "var(--althy-amber-bg)" : "var(--althy-red-bg)") : S.surface,
                        color: piece.etat === opt.value ? opt.color : S.text3,
                        fontSize: 11, fontWeight: 600,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Commentaire */}
                <textarea
                  value={piece.commentaire}
                  onChange={e => setPiece(idx, { commentaire: e.target.value })}
                  placeholder="Observations, remarques..."
                  rows={2}
                  style={{
                    width: "100%", borderRadius: 8, border: `1px solid ${S.border}`,
                    padding: "8px 10px", fontSize: 12, color: S.text, resize: "none",
                    background: S.surface, fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />

                {/* Photos (placeholder mobile-friendly) */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {piece.photos.map((url, pi) => (
                    <div key={pi} style={{ position: "relative" }}>
                      <img src={url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                      <button
                        onClick={() => setPiece(idx, { photos: piece.photos.filter((_, j) => j !== pi) })}
                        style={{ position: "absolute", top: -4, right: -4, background: S.red, border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                  <label
                    style={{
                      width: 64, height: 64, borderRadius: 6,
                      border: `2px dashed ${S.border}`, display: "flex",
                      flexDirection: "column", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", color: S.text3, gap: 2,
                    }}
                  >
                    <Upload size={14} />
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Photo</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = URL.createObjectURL(f);
                      setPiece(idx, { photos: [...piece.photos, url] });
                    }} />
                  </label>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Ajouter une pièce */}
      <button
        onClick={() => onChange([...pieces, { nom: `Pièce ${pieces.length + 1}`, etat: "", commentaire: "", photos: [] }])}
        style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 8,
          background: "none", border: `1px dashed ${S.border}`, borderRadius: 8,
          padding: "6px 12px", cursor: "pointer", color: S.text3, fontSize: 12,
        }}
      >
        <Plus size={12} /> Ajouter une pièce
      </button>
    </Card>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function ChangementPage() {
  const { id: bienId } = useParams<{ id: string }>();
  const [changement, setChangement] = useState<Changement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // EDL local state (non-sauvegardé auto)
  const [piecesEdlSortie, setPiecesEdlSortie] = useState<Piece[]>(PIECES_DEFAUT);
  const [piecesEdlEntree, setPiecesEdlEntree] = useState<Piece[]>(PIECES_DEFAUT);
  const [cautionRetenue, setCautionRetenue] = useState("");
  const [cautionMotif, setCautionMotif] = useState("");
  const [dateDepart, setDateDepart] = useState("");

  // ── Chargement ─────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/biens/${bienId}/changement/actif`);
      setChangement(data);
      if (data) {
        if (data.edl_sortie?.pieces?.length) setPiecesEdlSortie(data.edl_sortie.pieces);
        if (data.edl_entree?.pieces?.length) setPiecesEdlEntree(data.edl_entree.pieces);
        if (data.caution_retenue) setCautionRetenue(String(data.caution_retenue));
        if (data.caution_motif) setCautionMotif(data.caution_motif);
        if (data.date_depart_prevu) setDateDepart(data.date_depart_prevu);
      }
    } catch {
      setError("Impossible de charger le changement");
    } finally {
      setLoading(false);
    }
  }, [bienId]);

  useEffect(() => { load(); }, [load]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function creer() {
    setSaving(true);
    try {
      const { data } = await api.post(`/biens/${bienId}/changement/creer`, {
        date_depart_prevu: dateDepart || null,
      });
      setChangement(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  }

  async function toggleChecklist(itemId: string) {
    if (!changement) return;
    const updated = changement.checklist_depart.map(i =>
      i.id === itemId ? { ...i, done: !i.done } : i
    );
    setChangement({ ...changement, checklist_depart: updated });
    try {
      const { data } = await api.put(`/biens/${bienId}/changement/${changement.id}/checklist`, {
        checklist: updated,
      });
      setChangement(data);
    } catch { /* revert silently */ }
  }

  async function passerRecherche() {
    if (!changement) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/biens/${bienId}/changement/${changement.id}/passer-recherche`);
      setChangement(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function sauvegarderEdl(type: "sortie" | "entree") {
    if (!changement) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/biens/${bienId}/changement/${changement.id}/edl`, {
        type,
        pieces: type === "sortie" ? piecesEdlSortie : piecesEdlEntree,
        caution_retenue: type === "sortie" && cautionRetenue ? parseFloat(cautionRetenue) : null,
        caution_motif: type === "sortie" ? cautionMotif || null : null,
      });
      setChangement(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Erreur sauvegarde EDL");
    } finally {
      setSaving(false);
    }
  }

  async function finaliserDepart() {
    if (!changement) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/biens/${bienId}/changement/${changement.id}/finaliser-depart`, {
        date_checkout: new Date().toISOString().slice(0, 10),
      });
      setChangement(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function finaliserEntree(bailSigne: boolean, loyerEnvoye: boolean) {
    if (!changement) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/biens/${bienId}/changement/${changement.id}/finaliser-entree`, {
        date_checkin: new Date().toISOString().slice(0, 10),
        bail_signe: bailSigne,
        premier_loyer_envoye: loyerEnvoye,
      });
      setChangement(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? "Erreur");
    } finally {
      setSaving(false);
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: "2rem", color: S.text3, fontSize: 14 }}>Chargement…</div>
    );
  }

  // Aucun changement en cours — écran de démarrage
  if (!changement) {
    return (
      <div style={{ padding: "1.5rem 1rem", maxWidth: 560 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: S.text, marginBottom: 6 }}>
          Cycle de changement de locataire
        </h2>
        <p style={{ fontSize: 13, color: S.text3, marginBottom: "1.5rem", lineHeight: 1.6 }}>
          Démarrez le processus de départ / arrivée : checklist, état des lieux de sortie et d&apos;entrée, gestion de la caution, remise des clés.
        </p>

        {error && (
          <div style={{ background: "var(--althy-red-bg)", border: `1px solid ${S.red}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: S.red, marginBottom: "1rem", display: "flex", gap: 8, alignItems: "center" }}>
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <Card>
          <label style={{ display: "block", fontSize: 12, color: S.text3, marginBottom: 4 }}>
            Date de départ prévue (optionnel)
          </label>
          <input
            type="date"
            value={dateDepart}
            onChange={e => setDateDepart(e.target.value)}
            style={{ width: "100%", borderRadius: 8, border: `1px solid ${S.border}`, padding: "8px 10px", fontSize: 13, color: S.text, background: S.surface, boxSizing: "border-box", marginBottom: 12 }}
          />
          <button
            onClick={creer}
            disabled={saving}
            style={{
              width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
              background: S.orange, color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <LogOut size={15} />
            {saving ? "Création…" : "Démarrer le changement"}
          </button>
        </Card>
      </div>
    );
  }

  // Cycle terminé
  if (changement.statut === "termine") {
    return (
      <div style={{ padding: "1.5rem 1rem", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
          <CheckCircle2 size={28} color={S.green} />
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: S.text, margin: 0 }}>Cycle terminé</h2>
            <p style={{ fontSize: 12, color: S.text3, margin: 0 }}>
              Check-in effectué le {fmtDate(changement.date_checkin)}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {changement.bail_signe && <Badge label="Bail signé" color={S.green} bg="var(--althy-green-bg)" />}
          {changement.premier_loyer_envoye && <Badge label="1er QR-loyer envoyé" color={S.blue} bg="var(--althy-blue-bg)" />}
          {changement.caution_retenue != null && changement.caution_retenue > 0 && (
            <Badge label={`Caution retenue : ${fmtCHF(changement.caution_retenue)}`} color={S.amber} bg="var(--althy-amber-bg)" />
          )}
        </div>
      </div>
    );
  }

  const phase = changement.phase;

  return (
    <div style={{ padding: "1.5rem 1rem", maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: S.text, margin: 0 }}>
          Cycle de changement
        </h2>
        <Badge label="En cours" color={S.orange} bg="var(--althy-orange-bg)" />
      </div>

      {error && (
        <div style={{ background: "var(--althy-red-bg)", border: `1px solid ${S.red}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: S.red, marginBottom: "1rem", display: "flex", gap: 8, alignItems: "center" }}>
          <AlertTriangle size={14} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: S.red, fontSize: 16 }}>×</button>
        </div>
      )}

      <PhaseSteps current={phase} />

      {/* ── Phase 1 : Départ annoncé ── */}
      {phase === "depart_annonce" && (
        <div>
          <Card style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <LogOut size={18} color={S.amber} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontWeight: 600, color: S.text, fontSize: 14, marginBottom: 2 }}>
                  Départ du locataire actuel
                </div>
                {changement.date_depart_prevu && (
                  <div style={{ fontSize: 12, color: S.text3 }}>
                    Date prévue : <strong>{fmtDate(changement.date_depart_prevu)}</strong>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <ChecklistCard items={changement.checklist_depart} onToggle={toggleChecklist} />

          <button
            onClick={passerRecherche}
            disabled={saving}
            style={{
              width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
              background: S.orange, color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <Search size={15} />
            {saving ? "Passage…" : "Passer en recherche de locataire →"}
          </button>
        </div>
      )}

      {/* ── Phase 2 : Recherche ── */}
      {phase === "recherche" && (
        <div>
          <Card style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Search size={18} color={S.blue} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: S.text, fontSize: 14, marginBottom: 4 }}>
                  Recherche en cours
                </div>
                <div style={{ fontSize: 12, color: S.text3, lineHeight: 1.6 }}>
                  L&apos;annonce a été publiée sur le marketplace. Les candidatures sont consultables depuis l&apos;onglet <strong>Locataire</strong>.
                </div>
              </div>
            </div>
          </Card>

          <div style={{ fontSize: 13, color: S.text2, marginBottom: "1rem", fontWeight: 500 }}>
            État des lieux de sortie
          </div>
          <EdlCard
            title="EDL sortie — pièce par pièce"
            pieces={piecesEdlSortie}
            onChange={setPiecesEdlSortie}
          />

          <Card style={{ marginBottom: "1rem" }}>
            <div style={{ fontWeight: 500, color: S.text, fontSize: 13, marginBottom: 10 }}>Caution</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: S.text3, display: "block", marginBottom: 4 }}>
                  Montant retenu (CHF)
                </label>
                <input
                  type="number"
                  min="0"
                  value={cautionRetenue}
                  onChange={e => setCautionRetenue(e.target.value)}
                  placeholder="0"
                  style={{ width: "100%", borderRadius: 8, border: `1px solid ${S.border}`, padding: "7px 10px", fontSize: 13, background: S.surface, boxSizing: "border-box" }}
                />
              </div>
            </div>
            <textarea
              value={cautionMotif}
              onChange={e => setCautionMotif(e.target.value)}
              placeholder="Motif de retenue (optionnel)..."
              rows={2}
              style={{ width: "100%", borderRadius: 8, border: `1px solid ${S.border}`, padding: "8px 10px", fontSize: 12, resize: "none", background: S.surface, fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </Card>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => sauvegarderEdl("sortie")}
              disabled={saving}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `2px solid ${S.orange}`, background: S.surface, color: S.orange, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Sauvegarder EDL
            </button>
            <button
              onClick={finaliserDepart}
              disabled={saving}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: S.orange, color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Validation…" : "Valider le check-out →"}
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 3 : Check-out ── */}
      {phase === "checkout" && (
        <div>
          <Card style={{ marginBottom: "1rem", background: "var(--althy-amber-bg)", borderColor: "var(--althy-amber)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <ClipboardList size={16} color="var(--althy-amber)" />
              <span style={{ fontSize: 13, color: "var(--althy-amber)", fontWeight: 500 }}>
                Check-out effectué{changement.date_checkout ? ` le ${fmtDate(changement.date_checkout)}` : ""}
                {changement.caution_retenue ? ` — Caution retenue : ${fmtCHF(changement.caution_retenue)}` : ""}
              </span>
            </div>
          </Card>

          <div style={{ fontSize: 13, color: S.text2, marginBottom: "1rem", fontWeight: 500 }}>
            État des lieux d&apos;entrée — nouveau locataire
          </div>
          <EdlCard
            title="EDL entrée — pièce par pièce"
            pieces={piecesEdlEntree}
            onChange={setPiecesEdlEntree}
            edlRef={changement.edl_sortie}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => sauvegarderEdl("entree")}
              disabled={saving}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `2px solid ${S.orange}`, background: S.surface, color: S.orange, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Sauvegarder EDL
            </button>
            <button
              onClick={() => setChangement({ ...changement, phase: "checkin" as Phase })}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: S.orange, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Passer au check-in →
            </button>
          </div>
        </div>
      )}

      {/* ── Phase 4 : Check-in ── */}
      {phase === "checkin" && (
        <CheckinPhase
          saving={saving}
          onFinaliser={finaliserEntree}
        />
      )}
    </div>
  );
}

// ── CheckinPhase ──────────────────────────────────────────────────────────────

function CheckinPhase({
  saving,
  onFinaliser,
}: {
  saving: boolean;
  onFinaliser: (bailSigne: boolean, loyerEnvoye: boolean) => void;
}) {
  const [bailSigne, setBailSigne] = useState(false);
  const [loyerEnvoye, setLoyerEnvoye] = useState(false);
  const [cleRemise, setCleRemise] = useState(false);

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: 600, color: S.text, fontSize: 14, marginBottom: 14, display: "flex", gap: 8, alignItems: "center" }}>
          <LogIn size={16} color={S.green} /> Check-in — remise des clés
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { id: "bail",  label: "Bail signé par le nouveau locataire",    checked: bailSigne,    set: setBailSigne },
            { id: "cle",   label: "Clés remises au nouveau locataire",      checked: cleRemise,    set: setCleRemise },
            { id: "loyer", label: "Premier QR-loyer envoyé par e-mail",     checked: loyerEnvoye,  set: setLoyerEnvoye },
          ].map(item => (
            <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={e => item.set(e.target.checked)}
                style={{ accentColor: S.green, width: 16, height: 16 }}
              />
              <span style={{ fontSize: 13, color: item.checked ? S.text3 : S.text, textDecoration: item.checked ? "line-through" : "none" }}>
                {item.label}
              </span>
              {item.checked && <CheckCircle2 size={14} color={S.green} />}
            </label>
          ))}
        </div>
      </Card>

      <div style={{ background: "var(--althy-green-bg)", border: "1px solid var(--althy-green)", borderRadius: 10, padding: "12px 14px", marginBottom: "1rem", fontSize: 12, color: "var(--althy-green)", lineHeight: 1.6 }}>
        <strong>Tout est prêt ?</strong> En finalisant le check-in, le cycle de changement sera marqué comme terminé et l&apos;onglet revient à la gestion normale.
      </div>

      <button
        onClick={() => onFinaliser(bailSigne, loyerEnvoye)}
        disabled={saving || !bailSigne}
        style={{
          width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
          background: bailSigne ? S.green : S.border,
          color: bailSigne ? "#fff" : S.text3,
          fontSize: 14, fontWeight: 600,
          cursor: saving || !bailSigne ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <UserCheck size={16} />
        {saving ? "Finalisation…" : "Finaliser le check-in ✓"}
      </button>
      {!bailSigne && (
        <p style={{ fontSize: 11, color: S.text3, textAlign: "center", marginTop: 6 }}>
          Le bail doit être signé pour finaliser
        </p>
      )}
    </div>
  );
}
