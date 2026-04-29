// src/app/app/(dashboard)/biens/[id]/page.tsx
// Vue d'ensemble complète — fiche bien éditable
"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, Clock, Download,
  ExternalLink, FileText, Loader2, Mail,
  Pencil, Plus, Sparkles, User, Wrench, XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
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
import { MiniMapBien } from "@/components/biens/MiniMapBien";
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

// ── SectionInfos ──────────────────────────────────────────────────────────────

function SectionInfos({ bienId }: { bienId: string }) {
  const { data: bien, isLoading } = useBien(bienId);
  const update = useUpdateBien(bienId);
  const [form, setForm] = useState<Partial<Bien>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (bien) {
      setForm({
        adresse: bien.adresse,
        ville: bien.ville,
        cp: bien.cp,
        type: bien.type,
        surface: bien.surface ?? undefined,
        etage: bien.etage ?? undefined,
      });
      setDirty(false);
    }
  }, [bien]);

  function set(k: keyof Bien, v: unknown) {
    setForm(f => ({ ...f, [k]: v }));
    setDirty(true);
  }

  async function save() {
    await update.mutateAsync(form);
    setDirty(false);
  }

  const TYPE_OPTIONS = [
    "appartement", "villa", "studio", "maison",
    "commerce", "bureau", "parking", "garage", "cave", "autre",
  ];

  if (isLoading) {
    return (
      <div style={CARD}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Skel h={14} w="40%" />
          <Skel h={38} />
          <Skel h={38} />
          <Skel h={38} />
        </div>
      </div>
    );
  }

  return (
    <div style={CARD}>
      <p style={SEC_TITLE}>Informations principales</p>

      <div style={FIELD}>
        <label style={LABEL}>Adresse</label>
        <input
          style={INPUT}
          value={form.adresse ?? ""}
          onChange={e => set("adresse", e.target.value)}
          placeholder="Rue de Rive 10"
        />
      </div>

      <div style={ROW}>
        <div style={{ ...FIELD, flex: 2 }}>
          <label style={LABEL}>Ville</label>
          <input
            style={INPUT}
            value={form.ville ?? ""}
            onChange={e => set("ville", e.target.value)}
            placeholder="Genève"
          />
        </div>
        <div style={{ ...FIELD, flex: 1 }}>
          <label style={LABEL}>NPA</label>
          <input
            style={INPUT}
            value={form.cp ?? ""}
            onChange={e => set("cp", e.target.value)}
            placeholder="1201"
          />
        </div>
      </div>

      <div style={ROW}>
        <div style={{ ...FIELD, flex: 2 }}>
          <label style={LABEL}>Type de bien</label>
          <select
            style={{ ...INPUT, cursor: "pointer" }}
            value={form.type ?? "appartement"}
            onChange={e => set("type", e.target.value)}
          >
            {TYPE_OPTIONS.map(t => (
              <option key={t} value={t}>{BIEN_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
        </div>
        <div style={{ ...FIELD, flex: 1 }}>
          <label style={LABEL}>Surface (m²)</label>
          <input
            style={INPUT}
            type="number"
            step="0.5"
            min="0"
            value={form.surface ?? ""}
            onChange={e => set("surface", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="55"
          />
        </div>
        <div style={{ ...FIELD, flex: 1 }}>
          <label style={LABEL}>Étage</label>
          <input
            style={INPUT}
            type="number"
            min="0"
            value={form.etage ?? ""}
            onChange={e => set("etage", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="2"
          />
        </div>
      </div>

      {dirty && (
        <button style={BTN_PRIMARY} onClick={save} disabled={update.isPending}>
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      )}
    </div>
  );
}

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
          P1.3 fix : pointe directement vers /app/communication?tab=messages
          au lieu du redirect 301 via /app/messagerie. Le pré-ciblage du
          locataire (?contact=X) sera Phase 2 quand le module global lira
          ce param.
        */}
        <Link
          href="/app/communication?tab=messages"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 9,
            background: C.prussianBg, color: C.prussian,
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}
        >
          <Mail size={13} /> Contacter
        </Link>
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

function SectionInterventions({ bienId }: { bienId: string }) {
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

  return (
    <div style={{ ...CARD, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ ...SEC_TITLE, marginBottom: 0 }}>Interventions</p>
        <Link
          href={bienLinks.interventions(bienId)}
          style={{ fontSize: 12, color: C.prussian, textDecoration: "none", fontWeight: 500 }}
        >
          {total > 0 ? `Voir tout (${total}) →` : "Voir tout →"}
        </Link>
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
          {/* P1.7 fix : ?action=new ouvre le form auto dans TabInterventions
              (cf _shared.tsx — useSearchParams initialise showForm). */}
          <Link
            href={`${bienLinks.interventions(bienId)}?action=new`}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: "9px 14px", borderRadius: 10,
              border: `1px solid var(--border-subtle)`,
              color: C.text2, fontSize: 13, fontWeight: 500, textDecoration: "none",
              marginTop: 12,
            }}
          >
            <Plus size={13} /> Nouvelle intervention
          </Link>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {dernieres.map(inter => {
            const is = INTER_STATUT[inter.statut] ?? { label: inter.statut, color: C.text2, bg: C.border };
            return (
              <div
                key={inter.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 10,
                  border: `1px solid var(--border-subtle)`,
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
              </div>
            );
          })}
        </div>
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

// ── CardHeaderBien — Hero Pattern B (200px photo + infos) ────────────────────

function CardHeaderBien({
  bienId,
  editing,
  onToggleEdit,
}: {
  bienId: string;
  editing: boolean;
  onToggleEdit: () => void;
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
      {/* Colonne 1 — Photo (si uploadée) → Mini-map Mapbox (si lat/lng)
          → Placeholder gradient (sinon).
          Upload UI photos = Phase 2 (l'API backend POST /biens/{id}/images
          existe déjà). */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          justifyContent: "stretch",
          borderRight: `1px solid var(--border-subtle)`,
          position: "relative",
          overflow: "hidden",
          minHeight: 200,
        }}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
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
        ) : (
          <MiniMapBien
            lat={bien.lat ?? null}
            lng={bien.lng ?? null}
            ville={bien.ville}
          />
        )}
      </div>

      {/* Colonne 2 — Infos hero */}
      <div
        style={{
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* Titre + statut */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 6,
            }}
          >
            <h1
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 400,
                fontSize: 26,
                color: C.text,
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              {bien.adresse}
            </h1>
            <Badge label={s.label} color={s.color} bg={s.bg} />
          </div>
          <p style={{ fontSize: 14, color: C.text2, margin: 0 }}>
            {bien.cp ? `${bien.cp} ` : ""}
            {bien.ville}
          </p>
        </div>

        {/* Métadonnées */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: 14,
            rowGap: 4,
            fontSize: 13,
            color: C.text2,
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

        {/* Action */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onToggleEdit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 9,
              border: `1px solid ${editing ? C.prussian : "var(--border-subtle)"}`,
              background: editing ? C.prussian : "transparent",
              color: editing ? "#fff" : C.text2,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            aria-pressed={editing}
          >
            <Pencil size={13} />
            {editing ? "Fermer" : "Modifier"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vue d'ensemble ────────────────────────────────────────────────────────────

function BienOverview() {
  const { id } = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "16px 20px 24px",
      }}
    >
      {/* Header bien — full width hero (Pattern B) */}
      <CardHeaderBien
        bienId={id}
        editing={editing}
        onToggleEdit={() => setEditing((e) => !e)}
      />

      {/* Édition complète conditionnelle (toggle via bouton "Modifier" du header) */}
      {editing && <SectionInfos bienId={id} />}

      {/*
        Grille 6 cards responsive — colonnes STRICTES (pas auto-fit) :
          - Mobile  (<768px)        : 1 colonne (ordre vertical)
          - Tablette (768-1023px)   : 2 colonnes (3 lignes)
          - Desktop (>=1024px)      : 3 colonnes (3×2 — tient en 1 viewport)
        Tailwind suffit ici (Tailwind est configuré dans tailwind.config.ts
        et scopé sur ce fichier via globals.css). Les cards elles-mêmes
        gardent leurs inline-styles (pattern dominant du fichier).
        Liens vers sous-pages via @/lib/bien-links (transition Phase 2-3
        modules globaux filtrés = modifier uniquement bien-links.ts).
      */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-stretch">
        <SectionLocataire bienId={id} />
        <SectionFinances bienId={id} />
        <SectionEstimationIA bienId={id} />
        <SectionInterventions bienId={id} />
        <SectionDocuments bienId={id} />
        <SectionHistorique bienId={id} />
      </div>
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
