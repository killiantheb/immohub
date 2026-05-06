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

import { useState } from "react";
import { ChevronDown, ChevronUp, Home, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { C } from "@/lib/design-tokens";
import { Card } from "@/app/app/(dashboard)/biens/[id]/_shared";
import {
  useUploadEdlPhoto,
  useDeleteEdlPhoto,
} from "@/lib/hooks/useChangements";

export interface Piece {
  nom: string;
  etat: "bon" | "usure_normale" | "degradation" | "";
  commentaire: string;
  photos: string[]; // paths relatifs (post PR-EDL-1)
}

export interface Edl {
  pieces: Piece[];
  inventaire: Record<string, unknown>;
}

const ETAT_OPTIONS = [
  { value: "bon",          label: "Bon état",       color: C.green },
  { value: "usure_normale", label: "Usure normale",  color: C.amber },
  { value: "degradation",  label: "Dégradation",    color: C.red },
] as const;

interface EdlCardProps {
  changementId: string;
  edlType: "entree" | "sortie";
  title: string;
  pieces: Piece[];
  onChange: (pieces: Piece[]) => void;
  edlRef?: Edl | null;
}

export function EdlCard({
  changementId,
  edlType,
  title,
  pieces,
  onChange,
  edlRef,
}: EdlCardProps) {
  const [open, setOpen] = useState<number | null>(0);
  // path -> signed URL en cache local (durée de vie : la session). Permet
  // d'afficher les miniatures juste après upload sans re-fetch.
  const [pathToUrl, setPathToUrl] = useState<Record<string, string>>({});
  // tempId interne pour les uploads en vol (per-piece) — affiche un spinner.
  const [pendingByPiece, setPendingByPiece] = useState<Record<number, number>>({});

  const uploadMut = useUploadEdlPhoto(changementId);
  const deleteMut = useDeleteEdlPhoto(changementId);

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

  return (
    <Card style={{ marginBottom: "1rem" }}>
      <div style={{ fontWeight: 600, color: C.text, fontSize: 14, marginBottom: 12 }}>{title}</div>
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
                  {piece.photos.map((path, pi) => (
                    <div key={`${path}-${pi}`} style={{ position: "relative" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={srcFor(path)}
                        alt=""
                        style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, background: C.surface }}
                      />
                      <button
                        onClick={() => handleDelete(idx, pi)}
                        aria-label="Supprimer la photo"
                        disabled={deleteMut.isPending}
                        style={{ position: "absolute", top: -4, right: -4, background: C.red, border: "none", borderRadius: "50%", width: 18, height: 18, cursor: deleteMut.isPending ? "not-allowed" : "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, opacity: deleteMut.isPending ? 0.6 : 1 }}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}

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
    </Card>
  );
}
