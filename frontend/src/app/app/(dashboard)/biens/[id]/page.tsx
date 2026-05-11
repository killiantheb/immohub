// src/app/app/(dashboard)/biens/[id]/page.tsx
// Vue d'ensemble complète — fiche bien éditable
"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle, Archive, Camera, Car, CheckCircle2, ChevronRight, Cigarette,
  Clock, Dog, Download, ExternalLink, FileText, Flame, Home as HomeIcon,
  Loader2, Mail, Pencil, Plus, Sofa, Sparkles, Trash2, TreePine,
  Trees, User, WashingMachine, Wind, Wrench, XCircle,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { isEnabled } from "@/lib/flags";
import {
  useBien, useUpdateBien, useLocataireActuel,
  usePaiements, useInterventions, useDocuments,
  useBienHistory, useRendementNet,
  type Bien,
} from "@/lib/hooks/useBiens";
import {
  Badge, Skel,
  fmtDate, fmtCHF, initials,
  INTER_STATUT, PAI_STATUT, DOC_LABELS, BIEN_TYPE_LABELS, BIEN_STATUT,
  daysUntil,
} from "./_shared";
import { NotificationDraft } from "@/components/NotificationDraft";
import { C } from "@/lib/design-tokens";
import { bienLinks } from "@/lib/bien-links";
import { DeleteBienModal } from "@/components/biens/DeleteBienModal";
import { CaracteristiquesModal } from "@/components/biens/CaracteristiquesModal";
import { PhotosManagerModal } from "@/components/biens/PhotosManagerModal";
import { InterventionsSidePanel } from "@/components/biens/InterventionsSidePanel";
import type { AuditLogEntry } from "@/lib/types";

// ── Design constants ──────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: "#fff",
  borderRadius: 24,
  border: `1px solid var(--border-subtle)`,
  padding: 28,
};
const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: C.text3,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};
const INPUT: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--cream)",
  border: `1px solid var(--border-subtle)`,
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 14,
  color: C.text,
  fontFamily: "inherit",
  outline: "none",
};
const BTN_PRIMARY: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 20px",
  borderRadius: 10,
  border: "none",
  background: C.prussian,
  color: "#fff",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
const BTN_GHOST: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 14px",
  borderRadius: 9,
  border: `1px solid var(--border-subtle)`,
  background: "transparent",
  color: C.text2,
  fontSize: 13,
  textDecoration: "none",
  fontFamily: "inherit",
  cursor: "pointer",
};
const SEC_TITLE: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  fontFamily: "var(--font-serif)",
  color: C.text,
  marginBottom: 20,
  marginTop: 0,
};
const FIELD: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  marginBottom: 16,
  flex: 1,
};
const ROW: React.CSSProperties = {
  display: "flex",
  gap: 12,
};

// ── SectionFinances ───────────────────────────────────────────────────────────

function SectionFinances({ bienId }: { bienId: string }) {
  const { data: bien, isLoading } = useBien(bienId);
  const { data: locataire } = useLocataireActuel(bienId);
  const { data: rendement, isLoading: rendementLoading } = useRendementNet(bienId);
  const update = useUpdateBien(bienId);
  const [form, setForm] = useState({ loyer: "", charges: "" });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (bien) {
      setForm({
        loyer: bien.loyer != null ? String(bien.loyer) : "",
        charges: bien.charges != null ? String(bien.charges) : "",
      });
      setDirty(false);
    }
  }, [bien]);

  function set(k: "loyer" | "charges", v: string) {
    setForm(f => ({ ...f, [k]: v }));
    setDirty(true);
  }

  async function save() {
    await update.mutateAsync({
      loyer: form.loyer ? (Number(form.loyer) as unknown as Bien["loyer"]) : undefined,
      charges: form.charges ? (Number(form.charges) as unknown as Bien["charges"]) : undefined,
    });
    setDirty(false);
  }

  const loyer = Number(form.loyer) || 0;
  const loyerNet = Math.round(loyer * 0.97);
  const revenuAnnuel = Math.round(loyerNet * 12);

  if (isLoading) {
    return (
      <div style={CARD}>
        <Skel h={14} w="30%" />
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <Skel h={38} /><Skel h={38} />
        </div>
      </div>
    );
  }

  return (
    <div style={CARD}>
      {/* P1.2 fix : ajout du lien "Détail →" en header (symétrie avec
          les autres cards Locataire/Interventions/Documents/Historique). */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <p style={{ ...SEC_TITLE, marginBottom: 0 }}>Finances</p>
        <Link
          href={bienLinks.finances(bienId)}
          style={{ fontSize: 12, color: C.prussian, textDecoration: "none", fontWeight: 500 }}
        >
          Détail →
        </Link>
      </div>

      <div style={ROW}>
        <div style={FIELD}>
          <label style={LABEL}>Loyer mensuel</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              style={{ ...INPUT, flex: 1 }}
              type="number"
              min="0"
              value={form.loyer}
              onChange={e => set("loyer", e.target.value)}
              placeholder="1500"
            />
            <span style={{ fontSize: 12, color: C.text3, whiteSpace: "nowrap" }}>CHF</span>
          </div>
        </div>
        <div style={FIELD}>
          <label style={LABEL}>Charges mensuelles</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              style={{ ...INPUT, flex: 1 }}
              type="number"
              min="0"
              value={form.charges}
              onChange={e => set("charges", e.target.value)}
              placeholder="150"
            />
            <span style={{ fontSize: 12, color: C.text3, whiteSpace: "nowrap" }}>CHF</span>
          </div>
        </div>
      </div>

      {locataire?.depot_garantie != null && (
        <div style={{ marginBottom: 16 }}>
          <p style={LABEL}>Caution (dépôt garantie)</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
            {fmtCHF(locataire.depot_garantie)}
          </p>
        </div>
      )}

      {loyer > 0 && (
        <div style={{
          padding: "14px 16px",
          borderRadius: 12,
          background: "var(--althy-prussian-bg)",
          marginBottom: dirty ? 16 : 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: C.text2 }}>Loyer net (après commission 3%)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              CHF {loyerNet.toLocaleString("fr-CH")}/mois
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: C.text2 }}>Loyer net annuel après commission</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>
              CHF {revenuAnnuel.toLocaleString("fr-CH")}
            </span>
          </div>

          {/* Rendement net Phase 1 (PR-B) — loyer brut - interventions année civile.
              Phase 2-3 enrichira via deductions[] (commission Althy, agence, etc.)
              sans rupture API. */}
          <div style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--althy-prussian-border)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}>
            {rendementLoading ? (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: C.text2 }}>
                  Rendement net {new Date().getFullYear()}
                </span>
                <span style={{ fontSize: 12, color: C.text3, fontStyle: "italic" }}>
                  Calcul…
                </span>
              </div>
            ) : rendement ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: C.text2 }}>
                    Rendement net {rendement.annee}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    CHF {Math.round(Number(rendement.rendement_net_chf)).toLocaleString("fr-CH")}
                  </span>
                </div>
                {rendement.deductions.map((d) => (
                  <div
                    key={d.type}
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ fontSize: 11, color: C.text3 }}>
                      − {d.label}
                    </span>
                    <span style={{ fontSize: 11, color: C.text3 }}>
                      −CHF {Math.round(Number(d.montant)).toLocaleString("fr-CH")}
                    </span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: C.text2 }}>Taux net</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.green }}>
                    {Number(rendement.rendement_net_pct).toFixed(1)}%
                  </span>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: C.text2 }}>
                  Rendement net {new Date().getFullYear()}
                </span>
                <span style={{ fontSize: 12, color: C.text3, fontStyle: "italic" }}>
                  Indisponible
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {dirty && (
        <button style={BTN_PRIMARY} onClick={save} disabled={update.isPending}>
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      )}
    </div>
  );
}

// ── SectionBail ───────────────────────────────────────────────────────────────

function SectionBail({ bienId }: { bienId: string }) {
  const { data: locataire, isLoading } = useLocataireActuel(bienId);

  if (isLoading) {
    return (
      <div style={CARD}>
        <Skel h={14} w="35%" />
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Skel h={48} /><Skel h={48} /><Skel h={48} /><Skel h={48} />
        </div>
      </div>
    );
  }

  if (!locataire) {
    return (
      <div style={CARD}>
        <p style={SEC_TITLE}>Bail en cours</p>
        <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>
          Aucun bail actif — ce bien est vacant.
        </p>
      </div>
    );
  }

  const joursRestants = locataire.date_sortie ? daysUntil(locataire.date_sortie) : null;
  const moisRestants = joursRestants != null ? Math.max(0, Math.round(joursRestants / 30.5)) : null;

  return (
    <div style={CARD}>
      <p style={SEC_TITLE}>Bail en cours</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: 20 }}>
        <div>
          <p style={{ ...LABEL, marginBottom: 4 }}>Début</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
            {fmtDate(locataire.date_entree)}
          </p>
        </div>
        <div>
          <p style={{ ...LABEL, marginBottom: 4 }}>Fin prévue</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>
            {locataire.date_sortie ? fmtDate(locataire.date_sortie) : "Indéterminé"}
          </p>
        </div>
        {moisRestants != null && (
          <div>
            <p style={{ ...LABEL, marginBottom: 4 }}>Durée restante</p>
            <p style={{
              fontSize: 14, fontWeight: 600, margin: 0,
              color: joursRestants != null && joursRestants <= 60 ? C.red : C.text,
            }}>
              {moisRestants} mois
            </p>
          </div>
        )}
        <div>
          <p style={{ ...LABEL, marginBottom: 4 }}>Renouvellement</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Automatique</p>
        </div>
      </div>

      {joursRestants != null && joursRestants <= 60 && (
        <div style={{
          padding: "12px 14px",
          borderRadius: 10,
          background: "var(--althy-red-bg)",
          marginBottom: 16,
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
        }}>
          <AlertTriangle size={14} style={{ color: C.red, flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: C.red, margin: 0 }}>
            Bail se termine dans <strong>{joursRestants} jours</strong>. Pensez au renouvellement.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          style={BTN_PRIMARY}
          onClick={() => window.open(
            `/app/sphere?prompt=${encodeURIComponent("Génère un avenant de bail pour ce bien")}`,
            "_self"
          )}
        >
          Générer un avenant
        </button>
        <Link href={bienLinks.locataire(bienId)} style={BTN_GHOST}>
          Détails du bail
        </Link>
      </div>
    </div>
  );
}

// ── SectionStatutLoyer ────────────────────────────────────────────────────────

function downloadBase64Pdf(base64: string, filename: string) {
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const blob = new Blob([buf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function SectionStatutLoyer({ bienId }: { bienId: string }) {
  const { data: paiements, isLoading } = usePaiements(bienId);
  const { data: locataire } = useLocataireActuel(bienId);
  const [draftChannel, setDraftChannel] = useState<"email" | "whatsapp" | null>(null);
  const [genLoading, setGenLoading] = useState<"qr" | "quittance" | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const moisCourant = new Date().toISOString().slice(0, 7);
  const paiement = paiements?.find(p => p.mois === moisCourant) ?? null;
  const ps = paiement ? PAI_STATUT[paiement.statut] : null;

  const accentColor = paiement?.statut === "recu"
    ? C.green
    : paiement?.statut === "retard"
    ? C.red
    : C.border;

  // Nom du locataire (note_interne contient souvent "Prénom Nom" via import CSV)
  const locNom = locataire?.note_interne?.split("\n")[0]?.trim() || "Locataire";

  // Contexte IA pour le draft
  const draftContext = paiement
    ? `Loyer en retard de ${paiement.jours_retard} jour${paiement.jours_retard > 1 ? "s" : ""}, montant ${fmtCHF(paiement.montant)}, échéance ${new Date(paiement.date_echeance).toLocaleDateString("fr-CH")}`
    : "";

  async function handleGenererQR() {
    setGenLoading("qr");
    setGenError(null);
    try {
      const { data } = await api.post("/loyers/generer-qr", {
        bien_id: bienId,
        mois: moisCourant,
      });
      if (data.download_url) {
        window.open(data.download_url, "_blank");
      } else {
        downloadBase64Pdf(data.pdf_base64, `qr-facture-${moisCourant}.pdf`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGenError(msg ?? "Erreur lors de la génération de la QR-facture");
    } finally {
      setGenLoading(null);
    }
  }

  async function handleGenererQuittance() {
    setGenLoading("quittance");
    setGenError(null);
    try {
      const { data } = await api.post("/loyers/quittance", {
        bien_id: bienId,
        mois: moisCourant,
      });
      if (data.download_url) {
        window.open(data.download_url, "_blank");
      } else {
        downloadBase64Pdf(data.pdf_base64, `quittance-${moisCourant}.pdf`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGenError(msg ?? "Erreur lors de la génération de la quittance");
    } finally {
      setGenLoading(null);
    }
  }

  if (isLoading) {
    return (
      <div style={{ ...CARD, borderLeft: `4px solid var(--border-subtle)` }}>
        <Skel h={100} />
      </div>
    );
  }

  return (
    <div style={{ ...CARD, borderLeft: `4px solid ${accentColor}` }}>
      <p style={SEC_TITLE}>Loyer du mois</p>

      {paiement && ps ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            {paiement.statut === "recu" ? (
              <CheckCircle2 size={28} style={{ color: C.green, flexShrink: 0 }} />
            ) : paiement.statut === "retard" ? (
              <XCircle size={28} style={{ color: C.red, flexShrink: 0 }} />
            ) : (
              <Clock size={28} style={{ color: C.amber, flexShrink: 0 }} />
            )}
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 4px" }}>
                {fmtCHF(paiement.montant)}
              </p>
              <Badge label={ps.label} color={ps.color} bg={ps.bg} />
            </div>
          </div>

          <p style={{ fontSize: 13, color: C.text2, margin: "0 0 4px" }}>
            Dû le {new Date(paiement.date_echeance).toLocaleDateString("fr-CH", {
              day: "numeric", month: "long", year: "numeric",
            })}
          </p>

          {paiement.jours_retard > 0 && (
            <p style={{ fontSize: 12, color: C.red, margin: "0 0 12px" }}>
              <strong>{paiement.jours_retard}</strong> jour{paiement.jours_retard > 1 ? "s" : ""} de retard
            </p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {paiement.statut === "retard" && (
              <>
                <button
                  onClick={() => setDraftChannel("email")}
                  style={{ ...BTN_PRIMARY, fontSize: 12, padding: "7px 12px" }}
                >
                  <Mail size={12} /> Email
                </button>
                <button
                  onClick={() => setDraftChannel("whatsapp")}
                  style={{
                    ...BTN_PRIMARY, fontSize: 12, padding: "7px 12px",
                    background: "var(--whatsapp-green)",
                  }}
                >
                  WhatsApp
                </button>
              </>
            )}
            {paiement.statut === "en_attente" && (
              <button
                onClick={handleGenererQR}
                disabled={genLoading === "qr"}
                style={{ ...BTN_PRIMARY, fontSize: 12, padding: "7px 12px", opacity: genLoading === "qr" ? 0.6 : 1 }}
              >
                {genLoading === "qr" ? <><Loader2 size={12} className="animate-spin" /> Génération…</> : "Générer QR-facture"}
              </button>
            )}
            {paiement.statut === "recu" && (
              <button
                onClick={handleGenererQuittance}
                disabled={genLoading === "quittance"}
                style={{ ...BTN_PRIMARY, fontSize: 12, padding: "7px 12px", opacity: genLoading === "quittance" ? 0.6 : 1 }}
              >
                {genLoading === "quittance" ? <><Loader2 size={12} className="animate-spin" /> Génération…</> : "Générer quittance"}
              </button>
            )}
          </div>
          {genError && (
            <p style={{ fontSize: 12, color: C.red, margin: "8px 0 0" }}>{genError}</p>
          )}
        </>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: C.text3, margin: "0 0 14px" }}>
            Aucun paiement enregistré pour ce mois.
          </p>
          <button
            onClick={handleGenererQR}
            disabled={genLoading === "qr"}
            style={{ ...BTN_PRIMARY, fontSize: 12, padding: "7px 12px", opacity: genLoading === "qr" ? 0.6 : 1 }}
          >
            {genLoading === "qr" ? <><Loader2 size={12} className="animate-spin" /> Génération…</> : "Générer QR-facture"}
          </button>
          {genError && (
            <p style={{ fontSize: 12, color: C.red, margin: "8px 0 0" }}>{genError}</p>
          )}
        </div>
      )}

      {draftChannel && (
        <NotificationDraft
          recipientName={locNom}
          context={draftContext}
          onClose={() => setDraftChannel(null)}
        />
      )}
    </div>
  );
}

// ── SectionLocataire ──────────────────────────────────────────────────────────

function SectionLocataire({ bienId }: { bienId: string }) {
  const { data: locataire, isLoading } = useLocataireActuel(bienId);

  if (isLoading) {
    return (
      <div style={CARD}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <Skel h={48} w={48} />
          <div style={{ flex: 1 }}><Skel h={14} /><div style={{ height: 4 }} /><Skel h={12} w="60%" /></div>
        </div>
        <Skel h={34} />
      </div>
    );
  }

  if (!locataire) {
    return (
      <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
        <p style={SEC_TITLE}>Locataire</p>

        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "16px 8px",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: C.amberBg ?? "rgba(245, 158, 11, 0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12,
          }}>
            <User size={26} style={{ color: C.amber }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>
            Bien vacant
          </p>
          <p style={{ fontSize: 12, color: C.text3, margin: 0, maxWidth: 240 }}>
            Aucun locataire actuel. Publiez le bien ou consultez les candidatures en attente.
          </p>
        </div>

        {/*
          P0.1 + P0.2 fix : remplace deux CTAs trompeurs.
          Avant : "Publier sur la marketplace" → /app/annonces (301 → liste biens)
                  "Voir candidatures"          → TabLocataire <Empty>
          Après : les deux pointent vers /app/candidatures (module global existant)
                  avec ?bien_id=X. Le filtre côté module sera Phase 2 — en
                  attendant, la liste complète s'affiche, ce qui est cohérent
                  avec l'intention.
        */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          <Link
            href={`/app/candidatures?bien_id=${bienId}`}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "9px 16px", borderRadius: 10,
              background: C.prussian, color: "#fff",
              fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}
          >
            Recevoir des candidatures
          </Link>
          <Link
            href={`/app/candidatures?bien_id=${bienId}&statut=en_attente`}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "8px 14px", borderRadius: 9,
              border: `1px solid var(--border-subtle)`,
              color: C.text2, fontSize: 13, textDecoration: "none",
            }}
          >
            Voir candidatures en attente
          </Link>
        </div>
      </div>
    );
  }

  // note_interne peut contenir "Prénom Nom" (import CSV) — on prend la 1ère ligne
  const nomBrut = locataire.note_interne?.split("\n")[0]?.trim();
  const nom = nomBrut && nomBrut.length > 0 ? nomBrut : "Locataire";
  const inis = initials(nom !== "Locataire" ? nom : locataire.id);

  return (
    <div style={CARD}>
      <p style={SEC_TITLE}>Locataire actuel</p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: C.prussianBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700, color: C.prussian,
          flexShrink: 0,
        }}>
          {inis}
        </div>
        <div>
          <p style={{ fontWeight: 600, color: C.text, margin: "0 0 2px", fontSize: 15 }}>{nom}</p>
          <p style={{ fontSize: 12, color: C.text3, margin: 0 }}>
            Depuis le {fmtDate(locataire.date_entree)}
          </p>
        </div>
      </div>

      {locataire.date_sortie && (
        <p style={{ fontSize: 12, color: C.text2, margin: "0 0 12px" }}>
          Départ prévu : {fmtDate(locataire.date_sortie)}
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {/*
          P1.3 fix (PR-A4) : pointe directement vers /app/communication
          (au lieu du redirect 301 via /app/messagerie).
          PR-A6 : ajout ?bien_id=X pour activer le banner contextuel sur la
          page communication. Le pré-ciblage d'un locataire spécifique
          (?contact=X) reste Phase 2.
          2026-05-11 — gelé derrière flag OAUTH_COMMUNICATION (§B.15).
          Sera remplacé par PR-2 « messagerie bailleur interne » Phase 1.0.
        */}
        {isEnabled("OAUTH_COMMUNICATION") && (
          <Link
            href={`/app/communication?tab=messages&bien_id=${bienId}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 9,
              background: C.prussianBg, color: C.prussian,
              fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}
          >
            <Mail size={13} /> Contacter
          </Link>
        )}
        <Link
          href={bienLinks.locataire(bienId)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 9,
            border: `1px solid var(--border-subtle)`,
            color: C.text2, fontSize: 13, textDecoration: "none",
          }}
        >
          <ExternalLink size={13} /> Profil complet
        </Link>
      </div>
    </div>
  );
}

// ── SectionInterventions ──────────────────────────────────────────────────────

function SectionInterventions({
  bienId,
  onOpenList,
  onCreate,
  onSelect,
}: {
  bienId: string;
  onOpenList: () => void;
  onCreate: () => void;
  onSelect: (interventionId: string) => void;
}) {
  const { data: interventions, isLoading } = useInterventions(bienId);
  const dernieres = interventions?.slice(0, 3) ?? [];

  if (isLoading) {
    return (
      <div style={CARD}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skel h={14} w="45%" />
          <Skel h={52} /><Skel h={52} />
        </div>
      </div>
    );
  }

  const total = interventions?.length ?? 0;
  const actives = interventions?.filter(i => i.statut !== "resolu").length ?? 0;

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 8 }}>
        <p style={{ ...SEC_TITLE, marginBottom: 0 }}>
          Interventions
          {actives > 0 && (
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 600,
              padding: "2px 8px", borderRadius: 999,
              color: C.amber, background: C.amberBg,
              fontFamily: "var(--font-sans, 'DM Sans', system-ui, sans-serif)",
              verticalAlign: "middle",
            }}>
              {actives} active{actives > 1 ? "s" : ""}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onCreate}
          aria-label="Signaler une nouvelle intervention"
          title="Signaler une intervention"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: 8,
            border: `1px solid ${C.border}`, background: "transparent",
            color: C.prussian, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <Plus size={15} />
        </button>
      </div>

      {dernieres.length === 0 ? (
        <>
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "16px 8px",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: C.prussianBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 12,
            }}>
              <Wrench size={24} style={{ color: C.prussian, opacity: 0.55 }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>
              Aucune intervention
            </p>
            <p style={{ fontSize: 12, color: C.text3, margin: 0, maxWidth: 240 }}>
              Signalez un problème pour qu&apos;un artisan intervienne.
            </p>
          </div>
          <button
            type="button"
            onClick={onCreate}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "9px 14px", borderRadius: 10,
              border: `1px solid var(--border-subtle)`,
              background: "transparent",
              color: C.text2, fontSize: 13, fontWeight: 500,
              marginTop: 12, fontFamily: "inherit", cursor: "pointer",
            }}
          >
            <Plus size={13} /> Nouvelle intervention
          </button>
        </>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dernieres.map(inter => {
              const is = INTER_STATUT[inter.statut] ?? { label: inter.statut, color: C.text2, bg: C.border };
              return (
                <button
                  key={inter.id}
                  type="button"
                  onClick={() => onSelect(inter.id)}
                  style={{
                    width: "100%",
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10,
                    border: `1px solid var(--border-subtle)`,
                    background: "transparent",
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  }}
                >
                  <Wrench size={14} style={{ color: C.amber, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 600, color: C.text,
                      margin: "0 0 3px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {inter.titre}
                    </p>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: "2px 8px", borderRadius: 20,
                      color: is.color, background: is.bg,
                    }}>
                      {is.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onOpenList}
            style={{
              marginTop: 12,
              fontSize: 12, color: C.prussian,
              textAlign: "center",
              border: "none", background: "transparent",
              fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              padding: "6px 0",
            }}
          >
            {total > 0 ? `Voir toutes (${total}) →` : "Voir toutes →"}
          </button>
        </>
      )}
    </div>
  );
}

// ── SectionDocuments ──────────────────────────────────────────────────────────

function SectionDocuments({ bienId }: { bienId: string }) {
  const { data: docs, isLoading } = useDocuments(bienId);
  const derniers = docs?.slice(0, 4) ?? [];

  if (isLoading) {
    return (
      <div style={CARD}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Skel h={14} w="50%" />
          <Skel h={46} /><Skel h={46} /><Skel h={46} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ ...SEC_TITLE, marginBottom: 0 }}>Documents récents</p>
        <Link href={bienLinks.documents(bienId)} style={{ fontSize: 12, color: C.prussian, textDecoration: "none", fontWeight: 500 }}>
          Voir tout →
        </Link>
      </div>

      {derniers.length === 0 ? (
        <>
          {/* P1.1 fix : densifie le cas vide avec icône + CTA, symétrique
              à la card Interventions vide. */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "16px 8px",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: C.prussianBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 12,
            }}>
              <FileText size={24} style={{ color: C.prussian, opacity: 0.55 }} />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>
              Aucun document
            </p>
            <p style={{ fontSize: 12, color: C.text3, margin: 0, maxWidth: 240 }}>
              Téléversez ou générez un document pour ce bien.
            </p>
          </div>
          <Link
            href={bienLinks.documents(bienId)}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "9px 14px", borderRadius: 10,
              border: `1px solid var(--border-subtle)`,
              color: C.text2, fontSize: 13, fontWeight: 500, textDecoration: "none",
              marginTop: 12,
            }}
          >
            <Plus size={13} /> Ajouter un document
          </Link>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {derniers.map(doc => (
            <div
              key={doc.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10,
                border: `1px solid var(--border-subtle)`,
              }}
            >
              <FileText size={14} style={{ color: C.blue, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13, fontWeight: 600, color: C.text,
                  margin: "0 0 2px",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {DOC_LABELS[doc.type] ?? doc.type}
                </p>
                <p style={{ fontSize: 11, color: C.text3, margin: 0 }}>
                  {fmtDate(doc.date_document ?? doc.created_at)}
                </p>
              </div>
              {doc.url_storage && (
                <a
                  href={doc.url_storage}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: C.text3, flexShrink: 0, lineHeight: 0 }}
                >
                  <Download size={14} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SectionEstimationIA — card de redirection vers l'estim détaillée ─────────

function SectionEstimationIA({ bienId }: { bienId: string }) {
  const features = [
    "Valeur de marché estimée",
    "Rendement locatif potentiel",
    "Recommandations IA personnalisées",
  ];

  return (
    <Link
      href={bienLinks.potentiel(bienId)}
      style={{
        ...CARD,
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        transition: "border-color 0.15s",
        borderLeft: `4px solid ${C.gold}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ ...SEC_TITLE, marginBottom: 0 }}>Estimation IA</p>
        <Sparkles size={18} style={{ color: C.gold }} />
      </div>

      <p style={{ fontSize: 13, color: C.text2, margin: "0 0 14px", lineHeight: 1.5 }}>
        Découvrez la valeur estimée de votre bien et son potentiel locatif grâce à l&apos;analyse IA.
      </p>

      <ul style={{
        listStyle: "none", padding: 0, margin: "0 0 14px",
        display: "flex", flexDirection: "column", gap: 8, flex: 1,
      }}>
        {features.map((f) => (
          <li
            key={f}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 13, color: C.text2,
            }}
          >
            <CheckCircle2 size={14} style={{ color: C.gold, flexShrink: 0 }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div style={{
        paddingTop: 12,
        borderTop: `1px solid var(--border-subtle)`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.prussian }}>
          Lancer l&apos;estimation →
        </span>
      </div>
    </Link>
  );
}

// ── SectionHistorique — timeline des événements audit du bien ────────────────

function SectionHistorique({ bienId }: { bienId: string }) {
  const { data: events, isLoading } = useBienHistory(bienId, 5);

  if (isLoading) {
    return (
      <div style={CARD}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skel h={14} w="40%" />
          <Skel h={36} /><Skel h={36} /><Skel h={36} />
        </div>
      </div>
    );
  }

  return (
    <div style={CARD}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ ...SEC_TITLE, marginBottom: 0 }}>Historique</p>
        {/* P1.6 fix : la sous-page /historique liste les anciens locataires
            (TabHistorique), tandis que cette card overview liste les
            événements audit log (création, modifs, etc.). On clarifie
            l'asymétrie en renommant la cible du lien. */}
        <Link
          href={bienLinks.historique(bienId)}
          style={{ fontSize: 12, color: C.prussian, textDecoration: "none", fontWeight: 500 }}
        >
          Voir anciens locataires →
        </Link>
      </div>

      {!events || events.length === 0 ? (
        <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>Aucun événement enregistré</p>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 0 }}>
          {events.map((event, idx) => (
            <TimelineItem key={event.id} event={event} isLast={idx === events.length - 1} />
          ))}
        </ol>
      )}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "create:bien": "Bien créé",
  "update:bien": "Bien modifié",
  "delete:bien": "Bien archivé",
  "create:locataire": "Locataire ajouté",
  "update:locataire": "Locataire modifié",
  "delete:locataire": "Locataire retiré",
  "create:intervention": "Intervention signalée",
  "update:intervention": "Intervention modifiée",
  "create:document": "Document ajouté",
  "delete:document": "Document supprimé",
  "create:changement_locataire": "Changement de locataire lancé",
  "update:changement_locataire": "Changement de locataire mis à jour",
  "create:paiement": "Paiement enregistré",
  "update:paiement": "Paiement modifié",
};

function TimelineItem({ event, isLast }: { event: AuditLogEntry; isLast: boolean }) {
  const key = `${event.action}:${event.resource_type}`;
  const label = ACTION_LABELS[key] ?? `${event.action} ${event.resource_type}`;

  return (
    <li style={{ display: "flex", gap: 12, paddingBottom: isLast ? 0 : 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: C.gold,
          marginTop: 6,
          flexShrink: 0,
        }} />
        {!isLast && (
          <div style={{ width: 1, flex: 1, background: C.border, marginTop: 4 }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: "0 0 2px" }}>
          {label}
        </p>
        <p style={{ fontSize: 11, color: C.text3, margin: 0 }}>
          {fmtDate(event.created_at)}
        </p>
      </div>
    </li>
  );
}

// ── Helpers Header Bien (PR-A11.A.1.b) ───────────────────────────────────────
//
// Le bloc « Caractéristiques du bien » du header expose tous les champs
// pertinents en grille 2×2. PARKING_CHIP_LABELS reste partagé avec le bloc
// Caractéristiques pour formatter la valeur Parking de manière courte.

const PARKING_CHIP_LABELS: Record<string, string> = {
  exterieur: "Extérieur",
  exterieur_couvert: "Couvert",
  interieur: "Intérieur",
  interieur_box: "Box",
};

// ── CardHeaderBien — Hero Pattern C (PR-A11.A.1) ─────────────────────────────
//
// Layout 40/60 desktop : carrousel photos zone gauche + adresse/méta/bloc
// caractéristiques zone droite. Remplace l'ancien Pattern B (240px photo + infos).
// Les 4 frictions UX du 29/04/2026 sont adressées progressivement :
//   - PR-A11.A.1 + .1.b (cette PR) : refonte CardHeaderBien
//   - PR-A11.A.2 : modale gestion photos
//   - PR-A11.A.3 : modale Caractéristiques en mode édition
//   - PR-A11.A.4 : retrait SectionInfos + SectionCaracteristiques (grille 3×2)

// ── Helpers du bloc Caractéristiques (PR-A11.A.1.b) ──────────────────────────

/** Une ligne label/valeur en grille 100px / 1fr — utilisée par les sections
 *  Configuration et Distances. Valeur "—" si null/undefined. */
function CaracRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}) {
  const isEmpty = value == null || value === "" || value === "—";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
      }}
    >
      <span style={{ color: C.textMuted, fontWeight: 400 }}>{label}</span>
      <span
        style={{
          color: isEmpty ? C.textMuted : valueColor ?? C.text,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {isEmpty ? "—" : value}
      </span>
    </div>
  );
}

/** Une ligne icône / label / valeur — utilisée par Équipements et Règles. */
function CaracIconRow({
  Icon,
  label,
  value,
}: {
  Icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  const isEmpty = value == null || value === "" || value === "—";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "16px 1fr auto",
        alignItems: "center",
        columnGap: 10,
        fontSize: 13,
      }}
    >
      <Icon size={14} style={{ color: C.prussian, opacity: isEmpty ? 0.4 : 1 }} />
      <span style={{ color: C.textMuted, fontWeight: 400 }}>{label}</span>
      <span
        style={{
          color: isEmpty ? C.textMuted : C.text,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {isEmpty ? "—" : value}
      </span>
    </div>
  );
}

const RESIDENCE_LABELS_HEADER: Record<string, string> = {
  principale: "Principale",
  secondaire: "Secondaire",
  mixte: "Mixte",
};

function buanderieValue(bien: Bien): string | null {
  if (bien.has_laundry_private) return "Privée";
  if (bien.has_laundry_building) return "Commune";
  return null;
}

/** Sous-titre de catégorie dans le bloc Caractéristiques du header. */
function CaracSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.06em",
        color: C.text,
        textTransform: "uppercase",
        margin: 0,
        paddingBottom: 6,
        borderBottom: `1px solid var(--border-subtle)`,
      }}
    >
      {children}
    </p>
  );
}

function CardHeaderBien({
  bienId,
  onModifyClick,
  onSeeAllCaracClick,
  onRequestDelete,
  onOpenPhotos,
}: {
  bienId: string;
  onModifyClick: () => void;
  onSeeAllCaracClick: () => void;
  onRequestDelete: () => void;
  onOpenPhotos: () => void;
}) {
  const { data: bien, isLoading } = useBien(bienId);
  const { data: locataire } = useLocataireActuel(bienId);

  if (isLoading || !bien) {
    return (
      <div style={{ ...CARD, padding: 0, overflow: "hidden", minHeight: 180 }}>
        <Skel h={180} />
      </div>
    );
  }

  // Photo principale : couverture si présente, sinon première image, sinon null
  const cover =
    bien.images?.find((img) => img.is_cover) ?? bien.images?.[0] ?? null;

  // Statut : si un locataire actif est lié, on prime sur bien.statut
  const statutKey = locataire ? "loue" : bien.statut;
  const s =
    BIEN_STATUT[statutKey] ??
    { label: statutKey, color: C.text2, bg: C.border };

  const typeLabel = BIEN_TYPE_LABELS[bien.type] ?? bien.type;

  return (
    <div
      className="card-header-bien-grid"
      style={{
        ...CARD,
        padding: 0,
        overflow: "hidden",
        display: "grid",
        minHeight: 200,
      }}
    >
      {/* Colonne 1 — Zone photos (PR-A11.A.1 → PR-A11.A.5)
          - Cover : la zone entière est cliquable (button) avec overlay au
            survol qui révèle « Gérer les photos » + assombrissement subtil.
          - Placeholder : button vide qui ouvre la même modale, utilise les
            classes existantes (.card-header-bien-photos-empty) pour conserver
            le hover or premium. */}
      {cover ? (
        <button
          type="button"
          onClick={onOpenPhotos}
          aria-label="Gérer les photos du bien"
          className="card-header-bien-photos card-header-bien-photos-cover"
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: 200,
            background: C.surface2,
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover.url}
            alt={bien.adresse}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <span
            aria-hidden
            className="card-header-bien-photos-overlay"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "rgba(15, 46, 76, 0.55)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              opacity: 0,
              transition: "opacity 200ms ease",
              backdropFilter: "blur(2px)",
            }}
          >
            <Camera size={18} />
            Gérer les photos
          </span>
        </button>
      ) : (
        <div
          className="card-header-bien-photos"
          style={{
            position: "relative",
            overflow: "hidden",
            minHeight: 200,
            background: "transparent",
          }}
        >
          <button
            type="button"
            onClick={onOpenPhotos}
            aria-label="Ajouter des photos au bien"
            className="card-header-bien-photos-empty"
          >
            <Camera size={40} className="card-header-bien-photos-empty-icon" />
            <p
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: C.prussian,
                margin: 0,
              }}
            >
              Ajouter des photos
            </p>
            <p
              style={{
                fontSize: 13,
                color: C.textMuted,
                margin: 0,
                textAlign: "center",
                maxWidth: 220,
              }}
            >
              Mettez votre bien en valeur
            </p>
          </button>
        </div>
      )}

      {/* Colonne 2 — Bloc Informations principales (PR-A11.A.1.b)
          Structure : titre + ville → meta ligne unique → bloc Caractéristiques
          (intégré au commit suivant) → lien Voir toutes → boutons.
          Tous les blocs sont séparés par une fine ligne `--border-subtle`. */}
      <div className="card-header-bien-infos">
        {/* Titre + statut */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 4,
            }}
          >
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 400,
                fontSize: 28,
                color: C.prussian,
                margin: 0,
                lineHeight: 1.15,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {bien.adresse}
            </h1>
            <Badge label={s.label} color={s.color} bg={s.bg} />
          </div>
          <p style={{ fontSize: 15, color: C.textMuted, margin: 0 }}>
            {bien.cp ? `${bien.cp} ` : ""}
            {bien.ville}
          </p>
        </div>

        {/* Méta ligne unique : type · m² · pièces · étage · loyer */}
        <div
          className="card-header-bien-section"
          style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: 12,
            rowGap: 4,
            fontSize: 14,
            fontWeight: 500,
            color: C.text,
          }}
        >
          <span>{typeLabel}</span>
          {bien.surface != null && <span>· {bien.surface} m²</span>}
          {bien.rooms != null && <span>· {bien.rooms} pièces</span>}
          {bien.etage != null && <span>· Étage {bien.etage}</span>}
          {bien.loyer != null && bien.loyer > 0 && (
            <span style={{ color: C.gold, fontWeight: 600 }}>
              · {fmtCHF(bien.loyer)}/mois
            </span>
          )}
        </div>

        {/* Bloc Caractéristiques — 4 sous-sections (Configuration, Équipements,
            Distances, Règles) en grille 2 colonnes desktop. */}
        <div className="card-header-bien-section card-header-bien-carac">
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: C.textMuted,
              textTransform: "uppercase",
              margin: "0 0 16px",
            }}
          >
            Caractéristiques du bien
          </p>

          <div className="card-header-bien-carac-grid">
            {/* A — Configuration */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <CaracSubtitle>Configuration</CaracSubtitle>
              <CaracRow label="Type" value={typeLabel} />
              <CaracRow
                label="Surface"
                value={bien.surface != null ? `${bien.surface} m²` : null}
              />
              <CaracRow
                label="Pièces"
                value={bien.rooms != null ? String(bien.rooms) : null}
              />
              <CaracRow
                label="Étage"
                value={bien.etage != null ? String(bien.etage) : null}
              />
              <CaracRow
                label="Année"
                value={
                  bien.annee_construction != null
                    ? String(bien.annee_construction)
                    : null
                }
              />
              <CaracRow
                label="DPE"
                value={bien.classe_energetique}
                valueColor={
                  bien.classe_energetique
                    ? getDpeColor(bien.classe_energetique)
                    : undefined
                }
              />
            </div>

            {/* B — Équipements */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <CaracSubtitle>Équipements</CaracSubtitle>
              <CaracIconRow
                Icon={Wind}
                label="Balcon"
                value={bien.has_balcony ? "Oui" : null}
              />
              <CaracIconRow
                Icon={TreePine}
                label="Terrasse"
                value={bien.has_terrace ? "Oui" : null}
              />
              <CaracIconRow
                Icon={Trees}
                label="Jardin"
                value={bien.has_garden ? "Oui" : null}
              />
              <CaracIconRow
                Icon={Flame}
                label="Cheminée"
                value={bien.has_fireplace ? "Oui" : null}
              />
              <CaracIconRow
                Icon={Archive}
                label="Cave"
                value={bien.has_storage ? "Oui" : null}
              />
              <CaracIconRow
                Icon={Car}
                label="Parking"
                value={
                  bien.parking_type
                    ? PARKING_CHIP_LABELS[bien.parking_type] ?? "Oui"
                    : null
                }
              />
              <CaracIconRow
                Icon={WashingMachine}
                label="Buanderie"
                value={buanderieValue(bien)}
              />
            </div>

            {/* C — Distances */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <CaracSubtitle>Distances</CaracSubtitle>
              <CaracRow
                label="Gare"
                value={
                  bien.distance_gare_minutes != null
                    ? `${bien.distance_gare_minutes} min`
                    : null
                }
              />
              <CaracRow
                label="Bus"
                value={
                  bien.distance_arret_bus_minutes != null
                    ? `${bien.distance_arret_bus_minutes} min`
                    : null
                }
              />
              <CaracRow
                label="Lac"
                value={
                  bien.distance_lac_minutes != null
                    ? `${bien.distance_lac_minutes} min`
                    : null
                }
              />
            </div>

            {/* D — Règles */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <CaracSubtitle>Règles</CaracSubtitle>
              <CaracIconRow
                Icon={Dog}
                label="Animaux"
                value={
                  bien.pets_allowed === true
                    ? "Oui"
                    : bien.pets_allowed === false
                    ? "Non"
                    : null
                }
              />
              <CaracIconRow
                Icon={Cigarette}
                label="Fumeurs"
                value={
                  bien.smoking_allowed === true
                    ? "Oui"
                    : bien.smoking_allowed === false
                    ? "Non"
                    : null
                }
              />
              <CaracIconRow
                Icon={Sofa}
                label="Meublé"
                value={
                  bien.is_furnished === true
                    ? "Oui"
                    : bien.is_furnished === false
                    ? "Non"
                    : null
                }
              />
              <CaracIconRow
                Icon={HomeIcon}
                label="Résidence"
                value={
                  bien.residence_type
                    ? RESIDENCE_LABELS_HEADER[bien.residence_type] ??
                      bien.residence_type
                    : null
                }
              />
            </div>
          </div>
        </div>

        {/* Lien Voir toutes les caractéristiques → */}
        <div className="card-header-bien-section">
          <button
            type="button"
            onClick={onSeeAllCaracClick}
            className="card-header-bien-link"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: 0,
              border: "none",
              background: "none",
              color: C.prussian,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Voir toutes les caractéristiques
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Actions — Modifier (plein prussian) + Supprimer (ghost rouge subtle) */}
        <div
          className="card-header-bien-actions"
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "flex-end",
            paddingTop: 24,
            borderTop: `1px solid var(--border-subtle)`,
          }}
        >
          <button
            type="button"
            onClick={onModifyClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: 10,
              border: "1px solid transparent",
              background: C.prussian,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Pencil size={16} />
            Voir / éditer les caractéristiques
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 10,
              border: `1px solid ${C.red}55`,
              background: "transparent",
              color: C.red,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Trash2 size={16} />
            Supprimer
          </button>
        </div>
      </div>

      {/* Modale Caractéristiques montée au niveau BienOverview — un seul
          point de mount pour gérer l'ouverture en mode lecture (lien
          "Voir toutes") OU en mode édition (bouton "Modifier"). */}
    </div>
  );
}

// ── DPE color helper (utilisé par CardHeaderBien chips + bloc caractéristiques) ─

function getDpeColor(classe: string | null | undefined): string {
  if (!classe) return C.text3;
  const map: Record<string, string> = {
    A: C.green,
    B: C.green,
    C: C.amber,
    D: C.amber,
    E: C.warning,
    F: C.red,
    G: C.red,
  };
  return map[classe.toUpperCase()] || C.text;
}

// ── Vue d'ensemble ────────────────────────────────────────────────────────────

function BienOverview() {
  const { id } = useParams<{ id: string }>();
  const { data: bien } = useBien(id);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [photosModalOpen, setPhotosModalOpen] = useState(false);
  const [caracModal, setCaracModal] = useState<{
    open: boolean;
    mode: "read" | "edit";
  }>({ open: false, mode: "read" });
  const [interventionsPanelOpen, setInterventionsPanelOpen] = useState(false);
  const [selectedInterventionId, setSelectedInterventionId] = useState<string | null>(null);
  const [interventionsCreating, setInterventionsCreating] = useState(false);

  const openInterventionsList = () => {
    setSelectedInterventionId(null);
    setInterventionsCreating(false);
    setInterventionsPanelOpen(true);
  };
  const openInterventionCreate = () => {
    setSelectedInterventionId(null);
    setInterventionsCreating(true);
    setInterventionsPanelOpen(true);
  };
  const openInterventionDetail = (id: string) => {
    setSelectedInterventionId(id);
    setInterventionsCreating(false);
    setInterventionsPanelOpen(true);
  };
  const closeInterventionsPanel = () => {
    setInterventionsPanelOpen(false);
    setInterventionsCreating(false);
    setSelectedInterventionId(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "16px 20px 24px",
      }}
    >
      {/* Header bien — full width hero (Pattern C) */}
      <CardHeaderBien
        bienId={id}
        onModifyClick={() => setCaracModal({ open: true, mode: "edit" })}
        onSeeAllCaracClick={() => setCaracModal({ open: true, mode: "read" })}
        onRequestDelete={() => setShowDeleteModal(true)}
        onOpenPhotos={() => setPhotosModalOpen(true)}
      />

      {/* SectionInfos retire en PR-A11.A.3 — son contenu est integralement
          couvert par la modale Caracteristiques en mode edition. Le composant
          lui-meme reste dans le fichier (cleanup definitif en PR-A11.A.4). */}

      {/*
        Grille 7 cards (PR-A10) responsive — colonnes STRICTES :
          - Mobile  (<768px)        : 1 colonne (ordre vertical)
          - Tablette (768-1023px)   : 2 colonnes
          - Desktop (>=1024px)      : 3 colonnes (3×2 + 1 sur la 3e ligne)
        Tailwind utilisé uniquement pour le grid responsive ; les cards
        elles-mêmes gardent leurs inline-styles (pattern dominant).
        Liens vers sous-pages via @/lib/bien-links (transition Phase 2-3
        modules globaux filtrés = modifier uniquement bien-links.ts).
      */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch">
        <SectionLocataire bienId={id} />
        <SectionFinances bienId={id} />
        <SectionEstimationIA bienId={id} />
        <SectionInterventions
          bienId={id}
          onOpenList={openInterventionsList}
          onCreate={openInterventionCreate}
          onSelect={openInterventionDetail}
        />
        <SectionDocuments bienId={id} />
        <SectionHistorique bienId={id} />
      </div>

      {/* Modale soft delete (PR-A10) — affichée uniquement quand demandée. */}
      {showDeleteModal && bien && (
        <DeleteBienModal
          bienId={id}
          bienAdresse={`${bien.adresse}, ${bien.ville}`}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {/* Modale Caractéristiques (PR-A11.A.3) — instance unique au niveau
          BienOverview. initialMode pilote l'ouverture en lecture (depuis le
          lien "Voir toutes" du header) ou en édition (bouton "Modifier"). */}
      <CaracteristiquesModal
        bienId={id}
        open={caracModal.open}
        onClose={() => setCaracModal((s) => ({ ...s, open: false }))}
        initialMode={caracModal.mode}
      />

      {/* Modale gestion photos (PR-A11.A.5) — déclenchée depuis la zone
          photos du header (cover cliquable ou placeholder vide). */}
      <PhotosManagerModal
        bienId={id}
        open={photosModalOpen}
        onClose={() => setPhotosModalOpen(false)}
      />

      {/* Side panel interventions (PR-A11.A.5 — partie 2) — déclenché
          depuis la card SectionInterventions (bouton +, clic ligne, lien
          « Voir toutes »). Le panel gère lui-même la bascule liste/détail
          via `selectedId` + `initialCreate`. */}
      <InterventionsSidePanel
        bienId={id}
        open={interventionsPanelOpen}
        onClose={closeInterventionsPanel}
        selectedId={selectedInterventionId}
        onSelect={(id) => setSelectedInterventionId(id)}
        initialCreate={interventionsCreating}
      />
    </div>
  );
}

export default function BienDetailPage() {
  return (
    <Suspense>
      <BienOverview />
    </Suspense>
  );
}
