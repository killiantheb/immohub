"use client";

/**
 * DocumentQuickGenerator — bouton contextuel de génération de document.
 * S'utilise sur n'importe quelle page (bien, contrat, standalone).
 * Affiche un aperçu inline + bouton imprimer.
 */

import { useState } from "react";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

interface Props {
  /** Label du bouton déclencheur */
  label: string;
  /** Icône (emoji) */
  icon?: string;
  /** Type de template à générer directement (si connu) */
  templateType?: string;
  /** ID du contrat lié */
  contractId?: string;
  /** ID du bien lié */
  bienId?: string;
  /** Extra params (charges_label, signed_date, etc.) */
  extra?: Record<string, string>;
  /** Si vrai, affiche un mini-wizard (demande de pièces smart) */
  smartPieces?: boolean;
  /** Si vrai, affiche un wizard mois/année pour la quittance */
  quittanceMode?: boolean;
  /** Style du bouton */
  variant?: "primary" | "outline" | "ghost";
}

const CONTRACT_TYPE_TO_TEMPLATE: Record<string, string> = {
  long_term:  "bail_annee",
  seasonal:   "bail_saison",
  short_term: "bail_saison",
  sale:       "bail_annee_avec_vente",
};

const LOCATION_TYPES = [
  { value: "annee",       label: "Location annuelle" },
  { value: "saison",      label: "Location saisonnière" },
  { value: "nuitee",      label: "Location à la nuitée" },
  { value: "commercial",  label: "Bail commercial" },
];

const TENANT_TYPES = [
  { value: "particulier", label: "Particulier" },
  { value: "societe",     label: "Société / Entreprise" },
];

const PIECES_MAP: Record<string, Record<string, string>> = {
  annee:      { particulier: "demande_pieces_annee",      societe: "demande_pieces_societe" },
  saison:     { particulier: "demande_pieces_saison",     societe: "demande_pieces_societe" },
  nuitee:     { particulier: "demande_pieces_nuitee",     societe: "demande_pieces_nuitee" },
  commercial: { particulier: "demande_pieces_commercial", societe: "demande_pieces_commercial" },
};

function btnStyle(variant: string): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: "inherit",
    cursor: "pointer",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    transition: "opacity 0.15s",
  };
  if (variant === "primary")  return { ...base, background: C.orange, color: "#fff", border: "none" };
  if (variant === "outline")  return { ...base, background: C.surface, color: C.orange, border: `1px solid ${C.orange}` };
  return { ...base, background: "transparent", color: C.text2, border: `1px solid ${C.border}` };
}

const now = new Date();

export function DocumentQuickGenerator({
  label,
  icon = "",
  templateType,
  contractId,
  bienId,
  extra = {},
  smartPieces = false,
  quittanceMode = false,
  variant = "outline",
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"wizard" | "loading" | "preview">("wizard");
  const [locationType, setLocationType] = useState("annee");
  const [tenantType, setTenantType] = useState("particulier");
  const [qMonth, setQMonth] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [qYear, setQYear] = useState(String(now.getFullYear()));
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  // Fiche bien wizard
  const [ficheAnnual, setFicheAnnual] = useState(true);
  const [ficheSeasonal, setFicheSeasonal] = useState(false);
  const [ficheNightly, setFicheNightly] = useState(false);
  const [fichePriceAnnual, setFichePriceAnnual] = useState("");
  const [fichePriceSeasonal, setFichePriceSeasonal] = useState("");
  const [fichePriceNightly, setFichePriceNightly] = useState("");

  const isFiche = templateType === "fiche_bien";

  function handleOpen() {
    setOpen(true);
    setStep("wizard");
    setHtml("");
    setError("");
    // Si pas de wizard → génère directement
    if (templateType && !smartPieces && !quittanceMode && !isFiche) {
      generate(templateType);
    }
  }

  function handleFicheGenerate() {
    const ficheExtra: Record<string, string> = {
      has_annual:   String(ficheAnnual),
      has_seasonal: String(ficheSeasonal),
      has_nightly:  String(ficheNightly),
    };
    if (fichePriceAnnual)   ficheExtra.price_annual   = fichePriceAnnual;
    if (fichePriceSeasonal) ficheExtra.price_seasonal = fichePriceSeasonal;
    if (fichePriceNightly)  ficheExtra.price_nightly  = fichePriceNightly;
    generate("fiche_bien", ficheExtra);
  }

  function handleQuittanceGenerate() {
    generate("quittance_loyer", { quittance_month: qMonth, quittance_year: qYear });
  }

  async function generate(ttype: string, extraOverride?: Record<string, string>) {
    setStep("loading");
    setError("");
    try {
      const { data } = await api.post<{ content_html: string }>("/documents/generate", {
        template_type: ttype,
        contract_id: contractId || null,
        bien_id: bienId || null,
        extra: { signed_date: new Date().toLocaleDateString("fr-CH"), ...extra, ...(extraOverride || {}) },
      });
      setHtml(data.content_html);
      setStep("preview");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Erreur de génération";
      setError(msg);
      setStep("wizard");
    }
  }

  function handlePiecesGenerate() {
    const ttype = PIECES_MAP[locationType]?.[tenantType] || "demande_pieces_annee";
    generate(ttype);
  }

  function print() {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  return (
    <>
      <button onClick={handleOpen} style={btnStyle(variant)}>
        {icon && <span>{icon}</span>} {label}
      </button>

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 40, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}>
          <div style={{ background: C.surface, borderRadius: 14, width: "min(92vw, 900px)", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: C.shadowMd }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{icon && `${icon} `}{label}</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: C.text3, lineHeight: 1 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: "auto", padding: step === "preview" ? 0 : 24 }}>

              {/* Wizard — quittance de loyer */}
              {step === "wizard" && quittanceMode && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {error && <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.red }}>{error}</div>}
                  <p style={{ fontSize: 13, color: C.text2 }}>Sélectionnez le mois pour lequel générer la quittance :</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Mois</p>
                      <select value={qMonth} onChange={(e) => setQMonth(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: C.surface, color: C.text }}>
                        {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m, i) => (
                          <option key={m} value={m}>{["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][i]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Année</p>
                      <select value={qYear} onChange={(e) => setQYear(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: C.surface, color: C.text }}>
                        {[String(now.getFullYear() - 1), String(now.getFullYear()), String(now.getFullYear() + 1)].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ background: C.orangeBg, borderRadius: 8, padding: "10px 14px", fontSize: 11, color: C.orange }}>
                    Quittance pour le mois de <strong>{["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][parseInt(qMonth)-1]} {qYear}</strong>
                  </div>
                  <button onClick={handleQuittanceGenerate} style={{ ...btnStyle("primary"), justifyContent: "center", padding: "11px 0" }}>
                    Générer la quittance
                  </button>
                </div>
              )}

              {/* Wizard — fiche bien */}
              {step === "wizard" && isFiche && (
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {error && <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.red }}>{error}</div>}
                  <p style={{ fontSize: 13, color: C.text2 }}>Configurez les modes de location pour cette fiche.</p>

                  {/* Annual */}
                  <div style={{ border: `1.5px solid ${ficheAnnual ? C.orange : C.border}`, borderRadius: 10, padding: "12px 16px", background: ficheAnnual ? C.orangeBg : C.surface }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <input type="checkbox" checked={ficheAnnual} onChange={e => setFicheAnnual(e.target.checked)} style={{ accentColor: C.orange, width: 16, height: 16 }} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>À l'année</span>
                    </label>
                    {ficheAnnual && (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>Loyer mensuel (CHF) — laisser vide pour utiliser celui du bien</p>
                        <input type="number" placeholder="ex: 1800" value={fichePriceAnnual} onChange={e => setFichePriceAnnual(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#fff" }} />
                      </div>
                    )}
                  </div>

                  {/* Seasonal */}
                  <div style={{ border: `1.5px solid ${ficheSeasonal ? C.orange : C.border}`, borderRadius: 10, padding: "12px 16px", background: ficheSeasonal ? C.orangeBg : C.surface }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <input type="checkbox" checked={ficheSeasonal} onChange={e => setFicheSeasonal(e.target.checked)} style={{ accentColor: C.orange, width: 16, height: 16 }} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>Saisonnier</span>
                    </label>
                    {ficheSeasonal && (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>Tarif saisonnier total (CHF)</p>
                        <input type="number" placeholder="ex: 4500" value={fichePriceSeasonal} onChange={e => setFichePriceSeasonal(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#fff" }} />
                      </div>
                    )}
                  </div>

                  {/* Nightly */}
                  <div style={{ border: `1.5px solid ${ficheNightly ? C.orange : C.border}`, borderRadius: 10, padding: "12px 16px", background: ficheNightly ? C.orangeBg : C.surface }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <input type="checkbox" checked={ficheNightly} onChange={e => setFicheNightly(e.target.checked)} style={{ accentColor: C.orange, width: 16, height: 16 }} />
                      <span style={{ fontWeight: 600, fontSize: 13, color: C.text }}>À la nuitée — génère un calendrier 12 mois</span>
                    </label>
                    {ficheNightly && (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>Prix de base par nuit (CHF)</p>
                        <input type="number" placeholder="ex: 120" value={fichePriceNightly} onChange={e => setFichePriceNightly(e.target.value)}
                          style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#fff" }} />
                        <p style={{ fontSize: 10, color: C.text3, marginTop: 6 }}>
                          Le calendrier affiche les 12 prochains mois avec les tarifs haute/basse saison calculés automatiquement.
                        </p>
                      </div>
                    )}
                  </div>

                  <button onClick={handleFicheGenerate} disabled={!ficheAnnual && !ficheSeasonal && !ficheNightly}
                    style={{ ...btnStyle("primary"), justifyContent: "center", padding: "11px 0", opacity: (!ficheAnnual && !ficheSeasonal && !ficheNightly) ? 0.4 : 1 }}>
                    Générer la fiche complète
                  </button>
                </div>
              )}

              {/* Wizard — demande de pièces */}
              {step === "wizard" && smartPieces && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {error && <div style={{ background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.red }}>{error}</div>}

                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Type de location</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {LOCATION_TYPES.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => setLocationType(o.value)}
                          style={{ padding: "10px 14px", border: `2px solid ${locationType === o.value ? C.orange : C.border}`, borderRadius: 8, background: locationType === o.value ? C.orangeBg : C.surface, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: locationType === o.value ? 600 : 400, color: locationType === o.value ? C.orange : C.text }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.text2, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Le locataire est…</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {TENANT_TYPES.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => setTenantType(o.value)}
                          style={{ padding: "10px 14px", border: `2px solid ${tenantType === o.value ? C.orange : C.border}`, borderRadius: 8, background: tenantType === o.value ? C.orangeBg : C.surface, cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: tenantType === o.value ? 600 : 400, color: tenantType === o.value ? C.orange : C.text }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: C.orangeBg, borderRadius: 8, padding: "10px 14px", fontSize: 11, color: C.orange }}>
                    Générera : <strong>{PIECES_MAP[locationType]?.[tenantType]?.replace("demande_pieces_", "Demande de pièces — ") || "…"}</strong>
                  </div>

                  <button onClick={handlePiecesGenerate} style={{ ...btnStyle("primary"), justifyContent: "center", padding: "11px 0" }}>
                    Générer la demande de pièces
                  </button>
                </div>
              )}

              {/* Loading */}
              {step === "loading" && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "60px 0" }}>
                  <div style={{ width: 40, height: 40, border: `3px solid ${C.surface2}`, borderTop: `3px solid ${C.orange}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ fontSize: 13, color: C.text3 }}>Génération en cours…</p>
                  <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                </div>
              )}

              {/* Preview */}
              {step === "preview" && html && (
                <iframe srcDoc={html} style={{ width: "100%", height: "68vh", border: "none" }} title="Aperçu" />
              )}
            </div>

            {/* Footer */}
            {step === "preview" && (
              <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
                <button onClick={print} style={btnStyle("primary")}>
                  Imprimer / Télécharger PDF
                </button>
                <button onClick={() => setStep("wizard")} style={btnStyle("ghost")}>
                  ← Nouveau
                </button>
                <button onClick={() => setOpen(false)} style={{ ...btnStyle("ghost"), marginLeft: "auto" }}>
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
