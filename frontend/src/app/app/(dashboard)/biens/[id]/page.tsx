// src/app/app/(dashboard)/biens/[id]/page.tsx
// Vue d'ensemble complète — fiche bien éditable
"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, Clock, Download,
  ExternalLink, FileText, Loader2, Mail, Wrench, XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  useBien, useUpdateBien, useLocataireActuel,
  usePaiements, useInterventions, useDocuments,
  type Bien,
} from "@/lib/hooks/useBiens";
import {
  Card, Badge, Skel,
  fmtDate, fmtCHF, initials,
  INTER_STATUT, PAI_STATUT, DOC_LABELS, BIEN_TYPE_LABELS,
  daysUntil,
} from "./_shared";
import { NotificationDraft } from "@/components/NotificationDraft";
import { C } from "@/lib/design-tokens";

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
  background: C.orange,
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
      <p style={SEC_TITLE}>Finances</p>

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
          background: "var(--althy-orange-bg)",
          marginBottom: dirty ? 16 : 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: C.text2 }}>Loyer net (après commission 3%)</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              CHF {loyerNet.toLocaleString("fr-CH")}/mois
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: C.text2 }}>Revenu annuel estimé</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>
              CHF {revenuAnnuel.toLocaleString("fr-CH")}
            </span>
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
        <Link href={`/app/biens/${bienId}/locataire`} style={BTN_GHOST}>
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
        property_id: bienId,
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
        property_id: bienId,
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
      <div style={CARD}>
        <p style={SEC_TITLE}>Locataire actuel</p>
        <p style={{ fontSize: 13, color: C.text3, margin: "0 0 14px" }}>
          Aucun locataire — ce bien est vacant.
        </p>
        <Link
          href="/app/annonces"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 16px", borderRadius: 10,
            background: C.orange, color: "#fff",
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}
        >
          Publier sur la marketplace →
        </Link>
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
          background: C.orangeBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, fontWeight: 700, color: C.orange,
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
        <Link
          href="/app/messagerie"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 9,
            background: C.orangeBg, color: C.orange,
            fontSize: 13, fontWeight: 600, textDecoration: "none",
          }}
        >
          <Mail size={13} /> Contacter
        </Link>
        <Link
          href={`/app/biens/${bienId}/locataire`}
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

  return (
    <div style={CARD}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ ...SEC_TITLE, marginBottom: 0 }}>Interventions</p>
        <Link href={`/app/biens/${bienId}/interventions`} style={{ fontSize: 12, color: C.orange, textDecoration: "none", fontWeight: 500 }}>
          Voir tout →
        </Link>
      </div>

      {dernieres.length === 0 ? (
        <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>Aucune intervention</p>
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
    <div style={CARD}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <p style={{ ...SEC_TITLE, marginBottom: 0 }}>Documents récents</p>
        <Link href={`/app/biens/${bienId}/documents`} style={{ fontSize: 12, color: C.orange, textDecoration: "none", fontWeight: 500 }}>
          Voir tout →
        </Link>
      </div>

      {derniers.length === 0 ? (
        <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>Aucun document</p>
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

// ── Vue d'ensemble ────────────────────────────────────────────────────────────

function BienOverview() {
  const { id } = useParams<{ id: string }>();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr",
        gap: 20,
        alignItems: "start",
      }}
    >
      {/* Colonne gauche */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionInfos bienId={id} />
        <SectionFinances bienId={id} />
        <SectionBail bienId={id} />
      </div>

      {/* Colonne droite */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <SectionStatutLoyer bienId={id} />
        <SectionLocataire bienId={id} />
        <SectionInterventions bienId={id} />
        <SectionDocuments bienId={id} />
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
