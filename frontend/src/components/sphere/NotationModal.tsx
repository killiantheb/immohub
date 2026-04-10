"use client";

/**
 * NotationModal — Modal de notation après transaction.
 * Utilisé quand la Sphère génère une notation_action.
 *
 * Usage:
 *   <NotationModal
 *     acteur={{ id: "uuid", prenom: "Marc", role: "artisan" }}
 *     contexteType="intervention"
 *     contexteId="uuid-optionnel"
 *     onClose={() => {}}
 *     onDone={(nouvelleMoyenne) => {}}
 *   />
 */

import { useState } from "react";
import { Shield, Star, X } from "lucide-react";
import { api } from "@/lib/api";

interface Acteur {
  id:     string;
  prenom: string;
  nom?:   string;
  role?:  string;
}

interface Props {
  acteur:       Acteur;
  contexteType?: string;
  contexteId?:   string;
  onClose:      () => void;
  onDone?:      (nouvelleMoyenne: number) => void;
}

const ROLE_LABEL: Record<string, string> = {
  artisan:   "artisan",
  opener:    "ouvreur",
  agence:    "agence",
  proprio:   "propriétaire",
  locataire: "locataire",
  hunter:    "hunter",
  expert:    "expert",
};

const SCORE_LABELS: Record<number, string> = {
  1: "Décevant",
  2: "Passable",
  3: "Correct",
  4: "Très bien",
  5: "Excellent",
};

export function NotationModal({ acteur, contexteType = "mission", contexteId, onClose, onDone }: Props) {
  const [hover,    setHover]    = useState(0);
  const [score,    setScore]    = useState(0);
  const [comment,  setComment]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);
  const [moyenne,  setMoyenne]  = useState<number | null>(null);
  const [erreur,   setErreur]   = useState<string | null>(null);

  const displayed = hover || score;
  const nomComplet = [acteur.prenom, acteur.nom].filter(Boolean).join(" ");
  const roleLabel  = ROLE_LABEL[acteur.role ?? ""] ?? acteur.role ?? "acteur";

  async function validerNote() {
    if (!score || saving) return;
    setSaving(true);
    setErreur(null);
    try {
      const body: Record<string, unknown> = {
        acteur_id:    acteur.id,
        contexte_type: contexteType,
        score,
      };
      if (contexteId) body.contexte_id = contexteId;
      if (comment.trim()) body.commentaire = comment.trim();

      const res = await api.post<{ success: boolean; nouvelle_moyenne: number }>("/notations/", body);
      setMoyenne(res.data.nouvelle_moyenne);
      setDone(true);
      onDone?.(res.data.nouvelle_moyenne);
      setTimeout(onClose, 2000);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (msg?.includes("interaction")) {
        setErreur("Aucune interaction commune trouvée avec cet acteur.");
      } else if (msg?.includes("déjà")) {
        setErreur("Vous avez déjà noté cette interaction.");
      } else {
        setErreur("Erreur lors de l'envoi. Réessayez.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(26,22,18,0.5)", padding: 16 }}>
      <div style={{
        background: "var(--althy-surface)",
        borderRadius: 18,
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 24px 80px rgba(26,22,18,0.25)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--althy-border)" }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--althy-text)" }}>Laisser un avis</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--althy-text-3)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          {done ? (
            /* Success state */
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>⭐</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--althy-green)", margin: "0 0 4px" }}>
                Merci pour votre avis !
              </p>
              {moyenne !== null && (
                <p style={{ fontSize: 13, color: "var(--althy-text-3)", margin: 0 }}>
                  Nouvelle note de {nomComplet} : <strong style={{ color: "var(--althy-orange)" }}>{moyenne.toFixed(1)}/5</strong>
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Acteur name + role */}
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--althy-text)", margin: "0 0 4px" }}>
                Comment s&apos;est passée la mission avec {nomComplet} ?
              </p>
              <p style={{ fontSize: 12, color: "var(--althy-text-3)", margin: "0 0 20px" }}>
                {nomComplet} · {roleLabel}
              </p>

              {/* Stars */}
              <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setScore(n)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: displayed >= n ? "var(--althy-orange-bg)" : "var(--althy-surface-2)",
                      border: displayed >= n ? "2px solid var(--althy-orange)" : "2px solid transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s",
                    }}
                  >
                    <Star
                      size={20}
                      fill={displayed >= n ? "var(--althy-orange)" : "none"}
                      color={displayed >= n ? "var(--althy-orange)" : "var(--althy-text-3)"}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>

              {/* Score label */}
              <p style={{ fontSize: 12, color: displayed ? "var(--althy-orange)" : "var(--althy-text-3)", fontWeight: 600, margin: "0 0 16px", minHeight: 18 }}>
                {displayed ? SCORE_LABELS[displayed] : "Sélectionnez une note"}
              </p>

              {/* Badge Vérifié info */}
              {score >= 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "var(--althy-green-bg)", borderRadius: 8, border: "1px solid rgba(22,163,74,0.2)", marginBottom: 16 }}>
                  <Shield size={12} color="var(--althy-green)" />
                  <span style={{ fontSize: 11, color: "var(--althy-green)" }}>
                    Avis vérifié — cette interaction est confirmée dans le système Althy.
                  </span>
                </div>
              )}

              {/* Commentaire */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--althy-text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                  Commentaire (optionnel)
                </label>
                <input
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Ponctualité, qualité du travail, communication…"
                  maxLength={500}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1px solid var(--althy-border)",
                    borderRadius: 10,
                    fontSize: 13,
                    background: "var(--althy-bg)",
                    color: "var(--althy-text)",
                    outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Error */}
              {erreur && (
                <p style={{ fontSize: 12, color: "var(--althy-red)", margin: "0 0 12px", padding: "8px 12px", background: "var(--althy-red-bg)", borderRadius: 8 }}>
                  {erreur}
                </p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={onClose}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, background: "var(--althy-surface-2)", color: "var(--althy-text-3)", border: "1px solid var(--althy-border)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Passer
                </button>
                <button
                  onClick={validerNote}
                  disabled={!score || saving}
                  style={{
                    flex: 2,
                    padding: "10px 0",
                    borderRadius: 10,
                    background: !score ? "var(--althy-surface-2)" : "var(--althy-orange)",
                    color: !score ? "var(--althy-text-3)" : "#fff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: !score || saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                    fontFamily: "inherit",
                    transition: "all 0.18s",
                  }}
                >
                  {saving ? "Envoi…" : "Envoyer l'avis"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
