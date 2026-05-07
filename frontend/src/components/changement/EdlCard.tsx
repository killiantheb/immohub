"use client";

/**
 * EdlCard — carte EDL pièce-par-pièce, partagée entre la phase « recherche »
 * (saisie EDL sortie) et la phase « checkout » (saisie EDL entrée).
 *
 * Extrait inline depuis `app/biens/[id]/changement/page.tsx` (PR-EDL-1) pour
 * câbler le pipeline upload photos sans alourdir la page.
 *
 * Photos — pipeline (PR-EDL-1) :
 *   - Le JSONB stocké dans `edl_sortie.pieces[i].photos[]` contient des PATHS
 *     relatifs au bucket Supabase Storage privé `edl-photos`.
 *   - À l'upload, le backend retourne { url: signed_url, path }. Le `path`
 *     est ce qu'on persiste, l'`url` est cachée localement (Map<path, url>)
 *     pour afficher la miniature pendant la session.
 *   - Limitation tonight (PR-EDL-1) : après reload de page, les paths ne sont
 *     plus signés → les miniatures ne s'affichent plus (le bouton supprimer
 *     reste fonctionnel). PR-EDL-2 ajoutera la re-signature côté GET
 *     /changement/actif pour résoudre ça.
 */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Home, Loader2, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { C } from "@/lib/design-tokens";
import { Card } from "@/app/app/(dashboard)/biens/[id]/_shared";
import {
  signEdlPhotoPath,
  useUploadEdlPhoto,
  useDeleteEdlPhoto,
  useDraftEdl,
} from "@/lib/hooks/useChangements";

/**
 * Sous-élément d'une pièce (sol, murs, plafond, éclairage…) renvoyé par
 * `/ai/draft-edl`. Lecture seule Phase 1 ; édition Phase 2 (PR-EDL-2).
 * `condition` reste un string libre car l'IA peut renvoyer "à noter" en
 * plus des trois valeurs canoniques bon|moyen|mauvais.
 */
export interface EdlElement {
  name: string;
  condition: string;
  notes: string;
}

export interface Piece {
  nom: string;
  etat: "bon" | "usure_normale" | "degradation" | "";
  commentaire: string;
  photos: string[]; // paths relatifs (post PR-EDL-1)
  /**
   * Détails IA structurés (PR-EDL-2). Optionnel — les pièces saisies à la
   * main n'en ont pas. Pour les pièces issues de `/ai/draft-edl`, contient
   * les éléments (sol, murs, plafond, …) que l'IA a notés.
   */
  elements?: EdlElement[];
}

/**
 * Dégradation détectée par l'IA dans une comparaison entrée/sortie. Liste
 * libre Phase 1 (forme exacte non figée côté IA), affichage lecture seule.
 */
export interface EdlDegradation {
  location?: string;
  description?: string;
  estimated_cost_chf?: number | null;
  responsibility?: string;
  [key: string]: unknown;
}

export interface Edl {
  pieces: Piece[];
  inventaire: Record<string, unknown>;
  // ── Champs racine enrichis (PR-EDL-2) — tous optionnels, lecture seule
  // côté UI Phase 1. Renseignés après pré-remplissage `/ai/draft-edl`.
  general_condition?: "bon" | "moyen" | "mauvais" | "";
  keys_given?: Record<string, number>;
  meter_readings?: Record<string, number | null>;
  degradations?: EdlDegradation[];
  total_estimated_cost_chf?: number | null;
  remarks?: string;
}

const ETAT_OPTIONS = [
  { value: "bon",          label: "Bon état",       color: C.green },
  { value: "usure_normale", label: "Usure normale",  color: C.amber },
  { value: "degradation",  label: "Dégradation",    color: C.red },
] as const;

interface EdlCardProps {
  changementId: string;
  /**
   * `bienId` requis pour le pré-remplissage IA (`POST /ai/draft-edl`).
   * Optionnel : si omis, le bouton « Pré-remplir avec IA » n'est pas affiché.
   */
  bienId?: string;
  edlType: "entree" | "sortie";
  title: string;
  pieces: Piece[];
  onChange: (pieces: Piece[]) => void;
  /**
   * EDL de référence pour la comparaison (typiquement EDL sortie affichée
   * en lecture pendant la saisie EDL entrée).
   */
  edlRef?: Edl | null;
  /**
   * Champs racine de l'EDL courant (general_condition, keys_given,
   * meter_readings, degradations, total_estimated_cost_chf, remarks).
   * Affichés en lecture seule sous la liste des pièces (PR-EDL-2).
   */
  rootFields?: Pick<
    Edl,
    | "general_condition"
    | "keys_given"
    | "meter_readings"
    | "degradations"
    | "total_estimated_cost_chf"
    | "remarks"
  > | null;
  /**
   * Callback invoqué quand l'utilisateur applique un pré-remplissage IA.
   * Reçoit l'`Edl` complet (pieces[] + champs racine). Le parent décide
   * d'écraser son state local et de persister.
   */
  onApplyIaDraft?: (edl: Edl) => void;
}

export function EdlCard({
  changementId,
  bienId,
  edlType,
  title,
  pieces,
  onChange,
  edlRef,
  rootFields,
  onApplyIaDraft,
}: EdlCardProps) {
  const [open, setOpen] = useState<number | null>(0);
  // path -> signed URL en cache local. Peuplé : (a) à l'upload, (b) au mount
  // / changement de pieces via re-signature pour les paths déjà persistés.
  const [pathToUrl, setPathToUrl] = useState<Record<string, string>>({});
  // tempId interne pour les uploads en vol (per-piece) — affiche un spinner.
  const [pendingByPiece, setPendingByPiece] = useState<Record<number, number>>({});
  // Paths actuellement en cours de re-signature : affichage spinner mini.
  const [signingPaths, setSigningPaths] = useState<Record<string, true>>({});

  const uploadMut = useUploadEdlPhoto(changementId);
  const deleteMut = useDeleteEdlPhoto(changementId);
  // Hook IA : non monté si bienId absent (pas de bouton affiché de toute façon).
  // useDraftEdl appelé inconditionnellement pour respecter la règle des hooks ;
  // un bienId vide donnera un 422 backend si jamais déclenché — protégé par UI.
  const draftMut = useDraftEdl(bienId ?? "");

  // ── Modal de confirmation Option C — pré-remplissage IA ──────────────────
  // S'affiche uniquement si l'EDL n'est pas vierge (au moins une pièce avec
  // état, commentaire ou photos saisis), pour avertir avant écrasement.
  const [iaConfirmOpen, setIaConfirmOpen] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);

  function isEdlVierge(): boolean {
    return pieces.every(
      (p) => !p.etat && !p.commentaire && (p.photos?.length ?? 0) === 0,
    );
  }

  function piecesPhotosCount(): { pieces: number; photos: number } {
    const filled = pieces.filter(
      (p) => p.etat || p.commentaire || (p.photos?.length ?? 0) > 0,
    );
    const photos = pieces.reduce((acc, p) => acc + (p.photos?.length ?? 0), 0);
    return { pieces: filled.length, photos };
  }

  async function runDraftIa() {
    if (!bienId || !onApplyIaDraft) return;
    setIaError(null);
    try {
      const { edl } = await draftMut.mutateAsync({
        edlType,
        previousEdl: edlRef ?? null,
      });
      onApplyIaDraft(edl);
      setIaConfirmOpen(false);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (status === 429 || status === 503) {
        setIaError(detail ?? "Limite IA atteinte — réessayez dans une minute.");
      } else if (detail) {
        setIaError(detail);
      } else {
        setIaError("Erreur lors de la génération IA. Réessayez.");
      }
    }
  }

  function handleIaClick() {
    if (!bienId || !onApplyIaDraft) return;
    if (isEdlVierge()) {
      runDraftIa();
    } else {
      setIaConfirmOpen(true);
    }
  }

  // Dédup des appels de re-signature (évite double request si re-render
  // intervient entre déclenchement et résolution de la promise).
  const inFlightRef = useRef<Set<string>>(new Set());

  // Re-signe les paths apparaissant dans `pieces` qui ne sont ni dans le
  // cache ni en vol. Effet refire à chaque mutation de `pieces` (post-save
  // EDL recharge un nouveau set de paths) ou de `pathToUrl` (résolution
  // d'une signature précédente). Skip les URLs http(s) absolues — utiles
  // tant que le state contient des URLs fraîches injectées à l'upload.
  useEffect(() => {
    const allPaths = pieces.flatMap((p) => p.photos);
    const toSign = allPaths.filter(
      (p) =>
        p &&
        !p.startsWith("http://") &&
        !p.startsWith("https://") &&
        !pathToUrl[p] &&
        !inFlightRef.current.has(p),
    );
    if (toSign.length === 0) return;

    for (const path of toSign) {
      inFlightRef.current.add(path);
      setSigningPaths((s) => ({ ...s, [path]: true }));
      signEdlPhotoPath(changementId, path)
        .then(({ url }) => {
          setPathToUrl((m) => ({ ...m, [path]: url }));
        })
        .catch(() => {
          // Échec de signature : on ne tente pas de retry. La miniature
          // restera cassée pour ce path jusqu'au prochain mount.
        })
        .finally(() => {
          inFlightRef.current.delete(path);
          setSigningPaths((s) => {
            const next = { ...s };
            delete next[path];
            return next;
          });
        });
    }
  }, [pieces, pathToUrl, changementId]);

  function setPiece(idx: number, update: Partial<Piece>) {
    const next = pieces.map((p, i) => (i === idx ? { ...p, ...update } : p));
    onChange(next);
  }

  function bumpPending(idx: number, delta: number) {
    setPendingByPiece((prev) => {
      const next = { ...prev };
      const v = (next[idx] ?? 0) + delta;
      if (v <= 0) delete next[idx];
      else next[idx] = v;
      return next;
    });
  }

  async function handleUpload(idx: number, file: File) {
    bumpPending(idx, +1);
    try {
      const { url, path } = await uploadMut.mutateAsync({
        file,
        pieceIdx: idx,
        edlType,
      });
      setPathToUrl((m) => ({ ...m, [path]: url }));
      // Append au tableau photos avec la version courante de la pièce
      // (évite race condition avec un autre upload simultané sur même pièce).
      const current = pieces[idx];
      const nextPhotos = [...current.photos, path];
      const next = pieces.map((p, i) =>
        i === idx ? { ...p, photos: nextPhotos } : p,
      );
      onChange(next);
    } catch {
      // Erreur silencieuse côté UI : pourrait afficher un toast Phase 2.
    } finally {
      bumpPending(idx, -1);
    }
  }

  async function handleDelete(idx: number, photoIdx: number) {
    const path = pieces[idx].photos[photoIdx];
    try {
      await deleteMut.mutateAsync(path);
    } catch {
      // Si le storage delete échoue, on retire quand même côté UI : le path
      // resterait orphelin sinon (incohérence JSONB ↔ Storage). Acceptable
      // tonight ; un GC backend pourrait nettoyer Phase 2.
    }
    setPathToUrl((m) => {
      const rest = { ...m };
      delete rest[path];
      return rest;
    });
    setPiece(idx, {
      photos: pieces[idx].photos.filter((_, j) => j !== photoIdx),
    });
  }

  function srcFor(path: string): string {
    return pathToUrl[path] ?? path;
  }

  const showIaButton = !!bienId && !!onApplyIaDraft;
  const iaPending = draftMut.isPending;
  const counts = piecesPhotosCount();
  const hasRootDetails =
    !!rootFields &&
    (!!rootFields.general_condition ||
      (rootFields.keys_given && Object.keys(rootFields.keys_given).length > 0) ||
      (rootFields.meter_readings && Object.keys(rootFields.meter_readings).length > 0) ||
      (rootFields.degradations && rootFields.degradations.length > 0) ||
      rootFields.total_estimated_cost_chf != null ||
      !!rootFields.remarks);

  return (
    <Card style={{ marginBottom: "1rem" }}>
      {/* Header — titre + bouton IA (si bienId + callback fournis) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600, color: C.text, fontSize: 14 }}>{title}</span>
        {showIaButton && (
          <button
            onClick={handleIaClick}
            disabled={iaPending}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid ${C.gold}`,
              background: "var(--althy-gold-bg)",
              color: C.gold,
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: 8,
              cursor: iaPending ? "wait" : "pointer",
              opacity: iaPending ? 0.7 : 1,
            }}
            title="Génère un EDL pré-rempli via Claude (à réviser ensuite)"
          >
            {iaPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} />
            )}
            {iaPending ? "Génération…" : "Pré-remplir avec IA"}
          </button>
        )}
      </div>

      {/* Banner d'erreur IA — affiché en dessous du header, dans la card */}
      {iaError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            background: "var(--althy-red-bg)",
            border: `1px solid ${C.red}`,
            borderRadius: 8,
            padding: "8px 10px",
            marginBottom: 10,
            fontSize: 12,
            color: C.red,
          }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>{iaError}</span>
          <button
            onClick={() => setIaError(null)}
            aria-label="Fermer le message d'erreur"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.red,
              padding: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {pieces.map((piece, idx) => {
        const isOpen = open === idx;
        const refPiece = edlRef?.pieces?.[idx];
        const pendingCount = pendingByPiece[idx] ?? 0;

        return (
          <div
            key={idx}
            style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 8, marginBottom: 8 }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : idx)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "none", border: "none", cursor: "pointer",
                padding: "6px 0", color: C.text, fontSize: 13, fontWeight: 500,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Home size={14} color={C.text3} />
                {piece.nom}
                {piece.etat && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                    background: piece.etat === "bon" ? "var(--althy-green-bg)" : piece.etat === "usure_normale" ? "var(--althy-amber-bg)" : "var(--althy-red-bg)",
                    color: piece.etat === "bon" ? C.green : piece.etat === "usure_normale" ? "var(--althy-amber)" : C.red,
                  }}>
                    {ETAT_OPTIONS.find((e) => e.value === piece.etat)?.label}
                  </span>
                )}
              </span>
              {isOpen ? <ChevronUp size={14} color={C.text3} /> : <ChevronDown size={14} color={C.text3} />}
            </button>

            {isOpen && (
              <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Comparaison EDL ref */}
                {refPiece?.etat && (
                  <div style={{ fontSize: 12, color: C.text3, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px" }}>
                    <strong>EDL entrée :</strong> {ETAT_OPTIONS.find((e) => e.value === refPiece.etat)?.label}
                    {refPiece.commentaire && <> — {refPiece.commentaire}</>}
                  </div>
                )}

                {/* État */}
                <div style={{ display: "flex", gap: 8 }}>
                  {ETAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPiece(idx, { etat: opt.value as Piece["etat"] })}
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: 8, cursor: "pointer",
                        border: `2px solid ${piece.etat === opt.value ? opt.color : C.border}`,
                        background: piece.etat === opt.value ? (opt.value === "bon" ? "var(--althy-green-bg)" : opt.value === "usure_normale" ? "var(--althy-amber-bg)" : "var(--althy-red-bg)") : C.surface,
                        color: piece.etat === opt.value ? opt.color : C.text3,
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
                  onChange={(e) => setPiece(idx, { commentaire: e.target.value })}
                  placeholder="Observations, remarques..."
                  rows={2}
                  style={{
                    width: "100%", borderRadius: 8, border: `1px solid ${C.border}`,
                    padding: "8px 10px", fontSize: 12, color: C.text, resize: "none",
                    background: C.surface, fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />

                {/* Photos — upload via Supabase bucket privé `edl-photos` */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {piece.photos.map((path, pi) => {
                    const isSigning = !pathToUrl[path] && !!signingPaths[path];
                    return (
                      <div key={`${path}-${pi}`} style={{ position: "relative" }}>
                        {isSigning ? (
                          <div
                            style={{
                              width: 64, height: 64, borderRadius: 6,
                              border: `1px solid ${C.border}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: C.surface,
                            }}
                            aria-label="Chargement de la miniature"
                          >
                            <Loader2 size={16} className="animate-spin" style={{ color: C.text3 }} />
                          </div>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={srcFor(path)}
                            alt=""
                            style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, background: C.surface }}
                          />
                        )}
                        <button
                          onClick={() => handleDelete(idx, pi)}
                          aria-label="Supprimer la photo"
                          disabled={deleteMut.isPending}
                          style={{ position: "absolute", top: -4, right: -4, background: C.red, border: "none", borderRadius: "50%", width: 18, height: 18, cursor: deleteMut.isPending ? "not-allowed" : "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, opacity: deleteMut.isPending ? 0.6 : 1 }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Spinner placeholders pendant les uploads en vol */}
                  {Array.from({ length: pendingCount }, (_, i) => (
                    <div
                      key={`pending-${i}`}
                      style={{
                        width: 64, height: 64, borderRadius: 6,
                        border: `2px dashed ${C.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: C.surface,
                      }}
                    >
                      <Loader2
                        size={18}
                        className="animate-spin"
                        style={{ color: C.prussian }}
                      />
                    </div>
                  ))}

                  <label
                    style={{
                      width: 64, height: 64, borderRadius: 6,
                      border: `2px dashed ${C.border}`, display: "flex",
                      flexDirection: "column", alignItems: "center", justifyContent: "center",
                      cursor: uploadMut.isPending ? "wait" : "pointer", color: C.text3, gap: 2,
                      opacity: uploadMut.isPending ? 0.7 : 1,
                    }}
                  >
                    <Upload size={14} />
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          handleUpload(idx, f);
                        }
                        // Reset l'input pour permettre re-sélection du même fichier
                        e.target.value = "";
                      }}
                    />
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
          background: "none", border: `1px dashed ${C.border}`, borderRadius: 8,
          padding: "6px 12px", cursor: "pointer", color: C.text3, fontSize: 12,
        }}
      >
        <Plus size={12} /> Ajouter une pièce
      </button>

      {/* Détails IA — affichage lecture seule (PR-EDL-2). L'édition complète
          des elements[] / dégradations / clés / compteurs est Phase 2. */}
      {hasRootDetails && rootFields && (
        <IaDetailsSection rootFields={rootFields} />
      )}

      {/* Modal Option C — confirmation avant écrasement EDL non-vierge */}
      {iaConfirmOpen && (
        <ConfirmIaModal
          piecesCount={counts.pieces}
          photosCount={counts.photos}
          pending={iaPending}
          onCancel={() => setIaConfirmOpen(false)}
          onConfirm={runDraftIa}
        />
      )}
    </Card>
  );
}

// ── Sous-composants — section lecture seule + modale ────────────────────────

function IaDetailsSection({
  rootFields,
}: {
  rootFields: NonNullable<EdlCardProps["rootFields"]>;
}) {
  const conditionLabels: Record<string, string> = {
    bon: "Bon",
    moyen: "Moyen",
    mauvais: "Mauvais",
  };
  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: C.text2,
        }}
      >
        <Sparkles size={12} color={C.gold} />
        Détails IA
        <span style={{ fontSize: 10, fontWeight: 400, color: C.text3 }}>
          — édition complète à venir Phase 2
        </span>
      </div>

      {rootFields.general_condition && (
        <Row label="État général">
          {conditionLabels[rootFields.general_condition] ?? rootFields.general_condition}
        </Row>
      )}

      {rootFields.keys_given && Object.keys(rootFields.keys_given).length > 0 && (
        <Row label="Clés remises">
          {Object.entries(rootFields.keys_given)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · ")}
        </Row>
      )}

      {rootFields.meter_readings && Object.keys(rootFields.meter_readings).length > 0 && (
        <Row label="Compteurs">
          {Object.entries(rootFields.meter_readings)
            .map(([k, v]) => `${k}: ${v ?? "—"}`)
            .join(" · ")}
        </Row>
      )}

      {rootFields.degradations && rootFields.degradations.length > 0 && (
        <Row label={`Dégradations (${rootFields.degradations.length})`}>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {rootFields.degradations.map((d, i) => (
              <li key={i} style={{ fontSize: 12, color: C.text2 }}>
                {[d.location, d.description].filter(Boolean).join(" — ") ||
                  JSON.stringify(d)}
                {d.estimated_cost_chf != null && (
                  <span style={{ color: C.text3 }}>
                    {" "}· CHF {Number(d.estimated_cost_chf).toFixed(0)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Row>
      )}

      {rootFields.total_estimated_cost_chf != null && (
        <Row label="Coût estimé total">
          CHF {Number(rootFields.total_estimated_cost_chf).toFixed(2)}
        </Row>
      )}

      {rootFields.remarks && <Row label="Remarques">{rootFields.remarks}</Row>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
      <span style={{ color: C.text3, minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ color: C.text, flex: 1 }}>{children}</span>
    </div>
  );
}

function ConfirmIaModal({
  piecesCount,
  photosCount,
  pending,
  onCancel,
  onConfirm,
}: {
  piecesCount: number;
  photosCount: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ia-confirm-title"
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.5)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface,
          borderRadius: 12,
          maxWidth: 440,
          width: "100%",
          padding: 20,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          border: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Sparkles size={18} color={C.gold} />
          <h3
            id="ia-confirm-title"
            style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}
          >
            Pré-remplir avec IA ?
          </h3>
        </div>
        <p
          style={{
            fontSize: 13,
            color: C.text2,
            lineHeight: 1.6,
            margin: "0 0 14px",
          }}
        >
          L&apos;IA va remplacer votre saisie actuelle.{" "}
          <strong>
            {piecesCount} pièce{piecesCount > 1 ? "s" : ""}
          </strong>{" "}
          et{" "}
          <strong>
            {photosCount} photo{photosCount > 1 ? "s" : ""}
          </strong>{" "}
          seront perdues. Continuer ?
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={pending}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text2,
              fontSize: 13,
              fontWeight: 500,
              cursor: pending ? "not-allowed" : "pointer",
            }}
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={pending}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: C.gold,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: pending ? "wait" : "pointer",
              opacity: pending ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {pending && <Loader2 size={12} className="animate-spin" />}
            {pending ? "Génération…" : "Continuer"}
          </button>
        </div>
      </div>
    </div>
  );
}
