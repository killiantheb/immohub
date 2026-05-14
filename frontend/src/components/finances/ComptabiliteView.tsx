"use client";

/**
 * ComptabiliteView — Section "Finances / Comptabilité" (proprio_solo).
 *
 * Doctrine §B.15 (CLAUDE.md) :
 *   - Le "Scanner une facture" (drag&drop OCR IA + affectation OBLF auto) est
 *     Phase 2 (compta dynamique + OCR avancé, cf docs/2-ROADMAP.md §2.4.5).
 *     Phase 1.0 = exports statiques uniquement. Endpoint POST /factures/analyser
 *     conservé côté backend pour Phase 2.
 *   - La "Déclaration fiscale IA" (revenus locatifs préremplis) est Phase 2.
 *
 * Phase 1.0 disponible :
 *   - Export État locatif annuel (PDF + Excel fiduciaire)
 *   - Rapport de gestion (PDF)
 *   - Export CSV fiduciaire (legacy /ai/export/etat-locatif)
 *   - Print PDF (window.print)
 */

import { useState } from "react";
import { Download, FileText, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

type ExportAction = "download_pdf" | "export_excel" | "rapport_gestion";

const EXPORTS: { icon: string; title: string; sub: string; btn: string; action: ExportAction }[] = [
  { icon: "📄", title: "État locatif annuel",     sub: "Récapitulatif loyers par bien · PDF",  btn: "Générer PDF",   action: "download_pdf" },
  { icon: "📊", title: "Export Excel fiduciaire", sub: "Format compatible ERP suisse · XLSX",  btn: "Générer Excel", action: "export_excel" },
  { icon: "📈", title: "Rapport de gestion",      sub: "Performances & rendements · PDF",      btn: "Générer",       action: "rapport_gestion" },
];

const ACTION_ENDPOINTS: Record<ExportAction, (year: number) => string> = {
  download_pdf:     (y) => `/export/etat-locatif-pdf?year=${y}`,
  export_excel:     (y) => `/export/etat-locatif-xlsx?year=${y}`,
  rapport_gestion:  (y) => `/export/rapport-gestion?year=${y}`,
};

function ExportSection({ year }: { year: number }) {
  const [loading, setLoading] = useState<ExportAction | null>(null);
  const [error, setError]     = useState<string | null>(null);

  async function handleExport(action: ExportAction) {
    setLoading(action);
    setError(null);
    try {
      const url = ACTION_ENDPOINTS[action](year);
      const resp = await api.get(url, { responseType: "blob" });
      const contentDisp = resp.headers["content-disposition"] || "";
      const filenameMatch = contentDisp.match(/filename=(.+)/);
      const filename = filenameMatch ? filenameMatch[1] : `export_${action}_${year}`;
      const blobUrl = URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      setError("Erreur lors de la génération. Réessayez.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.text }}>Exports disponibles</h3>
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.redBg, borderRadius: 9, border: `1px solid ${C.red}`, marginBottom: 14 }}>
          <AlertCircle size={13} color={C.red} />
          <span style={{ fontSize: 12, color: C.red }}>{error}</span>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {EXPORTS.map(e => {
          const isLoading = loading === e.action;
          return (
            <div key={e.title} style={{ padding: "16px 18px", border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{e.icon}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, marginBottom: 3 }}>{e.title}</div>
              <div style={{ fontSize: 11.5, color: C.text3, marginBottom: 12 }}>{e.sub}</div>
              <button
                onClick={() => handleExport(e.action)}
                disabled={isLoading || loading !== null}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", border: `1px solid ${C.border}`, borderRadius: 8,
                  backgroundColor: isLoading ? C.prussianBg : C.surface2,
                  color: isLoading ? C.prussian : C.text2,
                  fontSize: 12, fontWeight: 600,
                  cursor: isLoading || loading !== null ? "default" : "pointer",
                  opacity: loading !== null && !isLoading ? 0.5 : 1,
                }}
              >
                {isLoading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                {e.btn}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const YEAR = new Date().getFullYear();

export function ComptabiliteView() {
  const [year, setYear] = useState(YEAR);
  const [exportingCsv, setExportingCsv] = useState(false);

  async function downloadCsv() {
    setExportingCsv(true);
    try {
      const resp = await api.get(`/ai/export/etat-locatif?year=${year}`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([resp.data], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `etat_locatif_${year}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <p style={{ margin: 0, color: C.text3, fontSize: 13 }}>États locatifs · Rapport annuel · Export fiduciaire</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            style={{ padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, backgroundColor: C.surface, color: C.text, outline: "none" }}>
            {[YEAR, YEAR - 1, YEAR - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => window.print()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: `1px solid ${C.border}`, borderRadius: 9, backgroundColor: C.surface, color: C.text2, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Download size={14} /> Export PDF
          </button>
          <button
            onClick={downloadCsv}
            disabled={exportingCsv}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: `1px solid ${C.prussian}`, borderRadius: 9, backgroundColor: C.prussianBg, color: C.prussian, fontSize: 13, fontWeight: 600, cursor: exportingCsv ? "default" : "pointer" }}
          >
            {exportingCsv ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <FileText size={14} />}
            Export CSV fiduciaire
          </button>
        </div>
      </div>

      <ExportSection year={year} />
    </div>
  );
}
