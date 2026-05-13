"use client";

/**
 * Admin Finances — Import CAMT.054 (Sprint 8 Lot D Frontend Loyer W7).
 *
 * Page super_admin (gate Sprint 7 Lot C : RESTRICTED_PAGES["/app/admin"]).
 * Téléverse un fichier CAMT.054 ISO 20022 fourni par la banque (e-banking),
 * appelle POST /api/v1/loyers/import-camt054 (Lot B backend) et affiche :
 *   - nombre de loyers matchés (via QR-référence) → marqués `recu`
 *   - nombre de transactions non matchées avec détail (raison, montant, ref).
 *
 * Doctrine §B.10 : aucun "Import réussi" inventé. On affiche strictement la
 * réponse backend. En cas d'erreur réseau/HTTP, on remonte le message tel quel.
 */

import { useRef, useState } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import { useImportCamt054 } from "@/lib/hooks/useLoyers";
import { btnP, btnS, Card, InfoRow } from "@/app/app/(dashboard)/biens/[id]/_shared";
import { C } from "@/lib/design-tokens";
import { TYPO_CAPTION, TYPO_LABEL_SMALL } from "@/lib/typography";

export default function AdminFinancesPage() {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mutation = useImportCamt054();

  const errorMsg =
    mutation.isError
      ? ((mutation.error as { response?: { data?: { detail?: string } }; message?: string })
          ?.response?.data?.detail ??
        (mutation.error as { message?: string })?.message ??
        "Erreur lors de l'import")
      : null;

  function handleSubmit() {
    if (!file) return;
    mutation.mutate(file);
  }

  function handleReset() {
    setFile(null);
    mutation.reset();
    if (inputRef.current) inputRef.current.value = "";
  }

  const result = mutation.data;

  return (
    <div style={{ padding: 32, maxWidth: 880, margin: "0 auto" }}>
      <header style={{ marginBottom: 24 }}>
        <p style={{ ...TYPO_LABEL_SMALL, color: C.gold, margin: "0 0 6px" }}>
          Réconciliation bancaire
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 26,
            fontWeight: 400,
            color: C.prussian,
            margin: 0,
            letterSpacing: "0.01em",
          }}
        >
          Import CAMT.054
        </h1>
        <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.5, marginTop: 8 }}>
          Importez un fichier CAMT.054 ISO 20022 depuis votre e-banking. Les transactions
          seront matchées avec les QR-références des loyers et les loyers correspondants
          seront automatiquement marqués <strong>reçus</strong>.
        </p>
      </header>

      <Card style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 16,
            fontWeight: 500,
            color: C.text,
            margin: "0 0 12px",
          }}
        >
          Téléverser le fichier
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label
            htmlFor="camt054-file"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 14,
              border: `1px dashed ${C.border2}`,
              borderRadius: 10,
              background: C.surface2,
              cursor: "pointer",
            }}
          >
            <FileUp size={18} style={{ color: C.prussian }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>
                {file ? file.name : "Sélectionnez un fichier .xml ou .054"}
              </p>
              {file && (
                <p style={{ ...TYPO_CAPTION, color: C.text3, margin: "2px 0 0" }}>
                  {(file.size / 1024).toFixed(1)} ko
                </p>
              )}
            </div>
            <input
              id="camt054-file"
              ref={inputRef}
              type="file"
              accept=".xml,.054,application/xml,text/xml"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!file || mutation.isPending}
              style={{ ...btnP, opacity: !file || mutation.isPending ? 0.6 : 1 }}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Import en cours…
                </>
              ) : (
                <>
                  <Upload size={13} /> Importer et matcher
                </>
              )}
            </button>
            {(file || result || errorMsg) && (
              <button type="button" onClick={handleReset} style={btnS}>
                Réinitialiser
              </button>
            )}
          </div>

          {errorMsg && (
            <p
              style={{
                fontSize: 13,
                color: C.red,
                background: C.redBg,
                padding: "8px 12px",
                borderRadius: 8,
                margin: 0,
              }}
            >
              {errorMsg}
            </p>
          )}
        </div>
      </Card>

      {result && (
        <Card>
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 16,
              fontWeight: 500,
              color: C.text,
              margin: "0 0 12px",
            }}
          >
            Résultat du matching
          </h2>
          <InfoRow
            label="Loyers matchés (marqués reçus)"
            value={
              <span style={{ color: C.green, fontWeight: 700 }}>{result.matched_count}</span>
            }
          />
          <InfoRow
            label="Transactions non matchées"
            value={
              <span
                style={{
                  color: result.unmatched_count > 0 ? C.amber : C.text2,
                  fontWeight: 700,
                }}
              >
                {result.unmatched_count}
              </span>
            }
          />

          {result.unmatched_details && result.unmatched_details.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ ...TYPO_LABEL_SMALL, color: C.text2, margin: "0 0 8px" }}>
                Détails à investiguer
              </p>
              <pre
                style={{
                  ...TYPO_CAPTION,
                  margin: 0,
                  padding: 12,
                  background: C.surface2,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  overflowX: "auto",
                  color: C.text2,
                  whiteSpace: "pre-wrap",
                }}
              >
                {JSON.stringify(result.unmatched_details, null, 2)}
              </pre>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
