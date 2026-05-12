"use client";

/**
 * DocumentTypeCard — carte 1-par-type du dossier locataire.
 *
 * 2 modes selon `isReadOnly` :
 *   - Locataire (isReadOnly=false) : upload, équivalent, suppression
 *   - Bailleur (isReadOnly=true)  : voir, valider, rejeter
 *
 * Statuts gérés :
 *   - Aucun doc → zone upload + texte format/taille
 *   - uploaded → bouton voir + (locataire : supprimer / bailleur : valider/rejeter)
 *   - valide   → bouton voir, badge vert
 *   - rejete   → bouton voir, badge rouge + motif visible (§B.10 transparence)
 *
 * Palette §B.4 stricte (0 orange).
 */

import { useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  type DocumentDossierRead,
  MAX_SIZE_BYTES,
  type TypeDocument,
  TYPE_DOCUMENT_LABELS,
  TYPE_DOCUMENT_POIDS,
  TYPES_AVEC_EQUIVALENT,
} from "@/lib/api/dossier-documents";
import { C } from "@/lib/design-tokens";


interface Props {
  type: TypeDocument;
  documents: DocumentDossierRead[];
  maxFichiers: number;
  isReadOnly: boolean; // true = bailleur view (pas d'upload, peut valider/rejeter)
  isLoading?: boolean; // mutation en cours
  onUpload?: (payload: {
    file: File;
    type_document: TypeDocument;
    est_equivalent?: boolean;
    equivalent_libelle?: string;
  }) => Promise<unknown> | void;
  onDelete?: (documentId: string) => Promise<unknown> | void;
  onOpen?: (documentId: string) => Promise<unknown> | void;
  onValidate?: (documentId: string) => Promise<unknown> | void;
  onReject?: (doc: DocumentDossierRead) => void;
}


// ── Helpers ───────────────────────────────────────────────────────────────────


function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}


function StatutBadge({ statut }: { statut: "uploaded" | "valide" | "rejete" }) {
  const map = {
    uploaded: { label: "En attente", color: C.prussian, bg: C.prussianBg, icon: Loader2 },
    valide:   { label: "Validé",     color: C.green,    bg: C.greenBg,    icon: CheckCircle2 },
    rejete:   { label: "Rejeté",     color: C.red,      bg: C.redBg,      icon: X },
  } as const;
  const cfg = map[statut];
  const Icon = cfg.icon;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 99,
        color: cfg.color,
        background: cfg.bg,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}


// ── Composant principal ───────────────────────────────────────────────────────


export function DocumentTypeCard({
  type,
  documents,
  maxFichiers,
  isReadOnly,
  isLoading = false,
  onUpload,
  onDelete,
  onOpen,
  onValidate,
  onReject,
}: Props) {
  const libelle = TYPE_DOCUMENT_LABELS[type];
  const poids = TYPE_DOCUMENT_POIDS[type];
  const acceptsEquivalent = TYPES_AVEC_EQUIVALENT.has(type);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showEquivalent, setShowEquivalent] = useState(false);
  const [equivalentLibelle, setEquivalentLibelle] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Slots dispo : on filtre les doc actifs (non-rejetés) pour le quota
  const activeDocs = documents.filter((d) => d.statut !== "rejete");
  const canAddMore = !isReadOnly && activeDocs.length < maxFichiers;
  const hasAnyDoc = documents.length > 0;

  async function handleFiles(files: FileList | File[]) {
    if (!onUpload || !canAddMore) return;
    setUploadError(null);
    const file = Array.from(files)[0];
    if (!file) return;

    if (showEquivalent && (!equivalentLibelle.trim() || equivalentLibelle.trim().length < 3)) {
      setUploadError("Précisez la nature de l'équivalent (min 3 caractères)");
      return;
    }

    try {
      await onUpload({
        file,
        type_document: type,
        est_equivalent: showEquivalent,
        equivalent_libelle: showEquivalent ? equivalentLibelle.trim() : undefined,
      });
      setShowEquivalent(false);
      setEquivalentLibelle("");
    } catch (err) {
      // Erreurs API standardisées (cf lib/api/dossier-documents.ts)
      const msg =
        (err as Error)?.message ??
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Échec de l'upload";
      setUploadError(msg);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!canAddMore) return;
    void handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "18px 20px",
        boxShadow: C.shadow,
      }}
    >
      {/* Header : titre + poids + statut global */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontSize: 16,
            fontWeight: 500,
            color: C.text,
            margin: 0,
            letterSpacing: "0.01em",
          }}
        >
          {libelle}
        </h3>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: C.gold,
            background: C.goldBg,
            padding: "3px 10px",
            borderRadius: 99,
          }}
        >
          {poids}%
        </span>
      </div>

      {/* Liste des documents existants */}
      {hasAnyDoc && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              isReadOnly={isReadOnly}
              isLoading={isLoading}
              onDelete={onDelete}
              onOpen={onOpen}
              onValidate={onValidate}
              onReject={onReject}
            />
          ))}
        </div>
      )}

      {/* Zone upload (locataire only) */}
      {canAddMore && (
        <>
          {/* Toggle équivalent (avant l'upload) */}
          {acceptsEquivalent && (
            <div
              style={{
                marginBottom: 10,
                padding: "10px 14px",
                background: C.surface2,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  color: C.text2,
                }}
              >
                <input
                  type="checkbox"
                  checked={showEquivalent}
                  onChange={(e) => setShowEquivalent(e.target.checked)}
                  style={{ accentColor: C.prussian }}
                />
                C&apos;est un document équivalent (promesse d&apos;embauche, mail
                d&apos;attente…)
              </label>
              {showEquivalent && (
                <input
                  type="text"
                  value={equivalentLibelle}
                  onChange={(e) => setEquivalentLibelle(e.target.value)}
                  placeholder="Ex: Promesse d'embauche signée"
                  maxLength={200}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    fontSize: 13,
                    fontFamily: "inherit",
                    background: C.surface,
                    color: C.text,
                    outline: "none",
                  }}
                />
              )}
            </div>
          )}

          {/* Zone drop */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            style={{
              border: `2px dashed ${dragOver ? C.prussian : C.border}`,
              borderRadius: 12,
              padding: "20px 16px",
              textAlign: "center",
              cursor: isLoading ? "wait" : "pointer",
              background: dragOver ? C.prussianBg : C.surface2,
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            {isLoading ? (
              <Loader2
                size={22}
                style={{ color: C.prussian, animation: "spin 1s linear infinite" }}
              />
            ) : (
              <Upload size={22} style={{ color: C.prussian, opacity: 0.7 }} />
            )}
            <p
              style={{
                fontSize: 13,
                color: C.text,
                margin: "8px 0 4px",
                fontWeight: 500,
              }}
            >
              {hasAnyDoc
                ? `Ajouter un fichier (${activeDocs.length}/${maxFichiers})`
                : "Cliquez ou glissez-déposez votre fichier"}
            </p>
            <p style={{ fontSize: 11, color: C.text3, margin: 0 }}>
              PDF, JPG, PNG · max {Math.round(MAX_SIZE_BYTES / 1024 / 1024)} MB
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            style={{ display: "none" }}
          />

          {uploadError && (
            <div
              role="alert"
              style={{
                marginTop: 10,
                padding: "8px 12px",
                background: C.redBg,
                color: C.red,
                fontSize: 12,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertCircle size={13} />
              {uploadError}
            </div>
          )}
        </>
      )}

      {/* Quota atteint */}
      {!isReadOnly && !canAddMore && activeDocs.length > 0 && (
        <p
          style={{
            fontSize: 11,
            color: C.text3,
            margin: "8px 0 0",
            fontStyle: "italic",
          }}
        >
          Quota atteint ({activeDocs.length}/{maxFichiers}). Supprimez un fichier
          actif ou attendez une décision du bailleur.
        </p>
      )}

      {/* Bailleur sans aucun doc */}
      {isReadOnly && !hasAnyDoc && (
        <p style={{ fontSize: 13, color: C.text3, margin: 0, fontStyle: "italic" }}>
          Pas encore fourni par le locataire.
        </p>
      )}
    </div>
  );
}


// ── Sub-component : DocumentRow ───────────────────────────────────────────────


function DocumentRow({
  doc,
  isReadOnly,
  isLoading,
  onDelete,
  onOpen,
  onValidate,
  onReject,
}: {
  doc: DocumentDossierRead;
  isReadOnly: boolean;
  isLoading: boolean;
  onDelete?: (documentId: string) => Promise<unknown> | void;
  onOpen?: (documentId: string) => Promise<unknown> | void;
  onValidate?: (documentId: string) => Promise<unknown> | void;
  onReject?: (doc: DocumentDossierRead) => void;
}) {
  const isUploaded = doc.statut === "uploaded";
  const isRejete = doc.statut === "rejete";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${isRejete ? C.red : C.border}`,
        background: C.surface,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={doc.filename_original}
          >
            {doc.filename_original}
          </p>
          <p style={{ fontSize: 11, color: C.text3, margin: "2px 0 0" }}>
            {fmtSize(doc.size_bytes)} · uploadé {new Date(doc.created_at).toLocaleDateString("fr-CH")}
            {doc.est_equivalent && doc.equivalent_libelle && (
              <span style={{ color: C.gold, fontWeight: 600 }}>
                {" "}
                · Équivalent : {doc.equivalent_libelle}
              </span>
            )}
          </p>
        </div>
        <StatutBadge statut={doc.statut} />
      </div>

      {/* Motif rejet (§B.10 transparence locataire) */}
      {isRejete && doc.commentaire_rejet && (
        <div
          style={{
            padding: "8px 12px",
            background: C.redBg,
            color: C.red,
            fontSize: 12,
            borderRadius: 8,
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            lineHeight: 1.5,
          }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>Motif du rejet : </strong>
            {doc.commentaire_rejet}
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onOpen && (
          <button
            type="button"
            onClick={() => void onOpen(doc.id)}
            disabled={isLoading}
            style={btnGhost}
          >
            <Eye size={13} />
            Voir
          </button>
        )}

        {/* Locataire : supprimer si statut uploaded */}
        {!isReadOnly && isUploaded && onDelete && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Supprimer ce document ?")) void onDelete(doc.id);
            }}
            disabled={isLoading}
            style={{ ...btnGhost, color: C.red, borderColor: C.red }}
          >
            <Trash2 size={13} />
            Supprimer
          </button>
        )}

        {/* Bailleur : valider / rejeter si statut uploaded */}
        {isReadOnly && isUploaded && (
          <>
            {onValidate && (
              <button
                type="button"
                onClick={() => void onValidate(doc.id)}
                disabled={isLoading}
                style={{
                  ...btnGhost,
                  color: "#fff",
                  background: C.green,
                  borderColor: C.green,
                }}
              >
                <Check size={13} />
                Valider
              </button>
            )}
            {onReject && (
              <button
                type="button"
                onClick={() => onReject(doc)}
                disabled={isLoading}
                style={{ ...btnGhost, color: C.red, borderColor: C.red }}
              >
                <X size={13} />
                Rejeter
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}


const btnGhost: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 12px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text2,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};
