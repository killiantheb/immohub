"use client";

/**
 * DocumentQuickGenerator — bouton contextuel de génération de document.
 * S'utilise sur n'importe quelle page (bien, contrat, standalone).
 * Affiche un aperçu inline + bouton imprimer.
 */

import { useState } from "react";
import { api } from "@/lib/api";

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
  propertyId?: string;
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

function btnStyle(variant: string) {
  const base = { fontFamily: "inherit", cursor: "pointer", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", transition: "opacity 0.15s" };
  if (variant === "primary")  return { ...base, background: "#D4601A", color: "#fff", border: "none" };
  if (variant === "outline")  return { ...base, background: "#fff", color: "#D4601A", border: "1px solid #D4601A" };
  return { ...base, background: "transparent", color: "#555", border: "1px solid #e5e5e5" };
}

const now = new Date();

export function DocumentQuickGenerator({
  label,
  icon = "📄",
  templateType,
  contractId,
  propertyId,
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

  function handleOpen() {
    setOpen(true);
    setStep("wizard");
    setHtml("");
    setError("");
    // Si pas de wizard → génère directement
    if (templateType && !smartPieces && !quittanceMode) {
      generate(templateType);
    }
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
        property_id: propertyId || null,
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
        <span>{icon}</span> {label}
      </button>

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 40, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "min(92vw, 900px)", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #eee" }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{icon} {label}</span>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#888", lineHeight: 1 }}>×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: "auto", padding: step === "preview" ? 0 : 24 }}>

              {/* Wizard — quittance de loyer */}
              {step === "wizard" && quittanceMode && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {error && <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>{error}</div>}
                  <p style={{ fontSize: 13, color: "#555" }}>Sélectionnez le mois pour lequel générer la quittance :</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Mois</p>
                      <select value={qMonth} onChange={(e) => setQMonth(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e5e5", borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
                        {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m, i) => (
                          <option key={m} value={m}>{["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][i]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Année</p>
                      <select value={qYear} onChange={(e) => setQYear(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #e5e5e5", borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
                        {[String(now.getFullYear() - 1), String(now.getFullYear()), String(now.getFullYear() + 1)].map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ background: "#f9f6f2", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#a05c28" }}>
                    Quittance pour le mois de <strong>{["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][parseInt(qMonth)-1]} {qYear}</strong>
                  </div>
                  <button onClick={handleQuittanceGenerate} style={{ ...btnStyle("primary"), justifyContent: "center", padding: "11px 0" }}>
                    🧾 Générer la quittance
                  </button>
                </div>
              )}

              {/* Wizard — demande de pièces */}
              {step === "wizard" && smartPieces && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {error && <div style={{ background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#b91c1c" }}>{error}</div>}

                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Type de location</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {LOCATION_TYPES.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => setLocationType(o.value)}
                          style={{ padding: "10px 14px", border: `2px solid ${locationType === o.value ? "#D4601A" : "#e5e5e5"}`, borderRadius: 8, background: locationType === o.value ? "#fff8f4" : "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: locationType === o.value ? 600 : 400, color: locationType === o.value ? "#D4601A" : "#333" }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Le locataire est…</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {TENANT_TYPES.map((o) => (
                        <button
                          key={o.value}
                          onClick={() => setTenantType(o.value)}
                          style={{ padding: "10px 14px", border: `2px solid ${tenantType === o.value ? "#D4601A" : "#e5e5e5"}`, borderRadius: 8, background: tenantType === o.value ? "#fff8f4" : "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit", fontWeight: tenantType === o.value ? 600 : 400, color: tenantType === o.value ? "#D4601A" : "#333" }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: "#f9f6f2", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#a05c28" }}>
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
                  <div style={{ width: 40, height: 40, border: "3px solid #f0e0d0", borderTop: "3px solid #D4601A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ fontSize: 13, color: "#888" }}>Génération en cours…</p>
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
              <div style={{ padding: "12px 20px", borderTop: "1px solid #eee", display: "flex", gap: 10 }}>
                <button onClick={print} style={btnStyle("primary")}>
                  🖨️ Imprimer / Télécharger PDF
                </button>
                <button onClick={() => setStep(smartPieces ? "wizard" : "wizard")} style={btnStyle("ghost")}>
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
