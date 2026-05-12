"use client";

/**
 * Dossier locataire — vue bailleur (Sprint 1B Module Dossier Locataire).
 *
 * Affiche le dossier complet du locataire actif d'un bien :
 *   - DossierProgressionBar read-only (bailleurView)
 *   - Renseignements en lecture seule
 *   - 8 DocumentTypeCard avec actions valider/rejeter
 *   - Cosignataires (read-only)
 *   - Bouton « Marquer loyer + caution versés » si pas encore fait
 *
 * Empty state si aucun locataire actif → CTA invitation.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Check, CheckCircle2, ClipboardCheck, Loader2, UserPlus } from "lucide-react";

import { BienBackButton } from "@/components/biens/BienBackButton";
import { CosignatairesForm } from "@/components/dossier/CosignatairesForm";
import { DocumentTypeCard } from "@/components/dossier/DocumentTypeCard";
import { DossierProgressionBar } from "@/components/dossier/DossierProgressionBar";
import { RejectDocumentModal } from "@/components/dossier/RejectDocumentModal";
import {
  type DocumentDossierRead,
  MAX_FICHIERS_PAR_TYPE,
  type TypeDocument,
  TYPE_DOCUMENT_LABELS,
} from "@/lib/api/dossier-documents";
import { useLocataireActuel } from "@/lib/hooks/useBiens";
import {
  useDossierDocuments,
  useMarkLoyerCautionVerses,
  useOpenDocument,
  useRejectDocument,
  useValidateDocument,
} from "@/lib/hooks/useDossierDocuments";
import { C } from "@/lib/design-tokens";


const ALL_DOC_ORDER: readonly TypeDocument[] = [
  "piece_identite",
  "permis_sejour",
  "contrat_travail",
  "fiches_salaire",
  "assurance_rc",
  "caution",
  "extrait_poursuites",
  "bail_signe",
];


export default function DossierLocataireBailleurPage() {
  const { id: bienId } = useParams<{ id: string }>();
  const locataireQuery = useLocataireActuel(bienId);
  const locataireId = locataireQuery.data?.id;
  const dossierQuery = useDossierDocuments(locataireId);

  const safeId = locataireId ?? "";
  const validate = useValidateDocument(safeId);
  const reject = useRejectDocument(safeId);
  const open = useOpenDocument();
  const markVerses = useMarkLoyerCautionVerses(safeId);

  const [rejectTarget, setRejectTarget] = useState<DocumentDossierRead | null>(null);

  // ── States ──────────────────────────────────────────────────────────────────

  if (locataireQuery.isLoading) {
    return (
      <>
        <BienBackButton bienId={bienId} />
        <p style={{ color: C.text3, textAlign: "center", padding: 40 }}>Chargement…</p>
      </>
    );
  }

  if (!locataireQuery.data) {
    return (
      <>
        <BienBackButton bienId={bienId} />
        <div
          style={{
            textAlign: "center",
            padding: 48,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
          }}
        >
          <ClipboardCheck size={36} style={{ color: C.text3, opacity: 0.4, marginBottom: 12 }} />
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 20,
              color: C.text,
              fontWeight: 400,
              margin: "0 0 12px",
            }}
          >
            Aucun locataire actif
          </h1>
          <p style={{ fontSize: 14, color: C.text2, margin: "0 0 24px", lineHeight: 1.5 }}>
            Invitez votre locataire pour qu&apos;il puisse créer son dossier.
          </p>
          <Link
            href={`/app/biens/${bienId}/locataire`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: 10,
              background: C.prussian,
              color: "#fff",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <UserPlus size={14} />
            Inviter le locataire
          </Link>
        </div>
      </>
    );
  }

  if (dossierQuery.isLoading || !dossierQuery.data) {
    return (
      <>
        <BienBackButton bienId={bienId} />
        <p style={{ color: C.text3, textAlign: "center", padding: 40 }}>
          Chargement du dossier…
        </p>
      </>
    );
  }

  const dossier = dossierQuery.data;
  const locataire = locataireQuery.data;
  const cosignataires = locataire.cosignataires ?? [];

  function docsOfType(type: TypeDocument) {
    return dossier.documents.filter((d) => d.type_document === type);
  }

  function maxFichiers(type: TypeDocument) {
    return MAX_FICHIERS_PAR_TYPE[type] ?? 1;
  }

  const renseignements = dossier.dossier;
  // Sprint 1B.1 (2026-05-12) : 100% strict pour finaliser, mais le bouton
  // « marquer versement » doit s'activer dès que le reste est complet (95%).
  // Le versement compte pour 5% — sans cette tolérance, on aurait un blocage
  // logique (impossible d'atteindre 100% sans avoir d'abord pu marquer le 5%).
  const isReady = dossier.progression >= 95;

  return (
    <>
      <BienBackButton bienId={bienId} />

      {/* Header dossier */}
      <div style={{ marginBottom: 20 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.gold,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            margin: "0 0 6px",
          }}
        >
          Dossier locataire
        </p>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 24,
            color: C.text,
            margin: 0,
            fontWeight: 500,
          }}
        >
          Locataire #{locataire.id.slice(0, 8)}
        </h1>
        <p style={{ fontSize: 12, color: C.text3, margin: "4px 0 0" }}>
          Compte créé le {new Date(locataire.created_at).toLocaleDateString("fr-CH")}
        </p>
      </div>

      {/* Progression read-only */}
      <div style={{ marginBottom: 28 }}>
        <DossierProgressionBar progression={dossier.progression} bailleurView />
      </div>

      {/* Renseignements read-only */}
      <SectionTitle title="Renseignements de base" />
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: C.shadow,
        }}
      >
        {renseignements && renseignements.renseignements_complets ? (
          <dl style={{ margin: 0, display: "grid", gap: 8 }}>
            <InfoRow label="Employeur" value={renseignements.employeur ?? "—"} />
            {renseignements.poste && (
              <InfoRow label="Poste" value={renseignements.poste} />
            )}
            <InfoRow
              label="Contrat"
              value={renseignements.type_contrat?.toUpperCase() ?? "—"}
            />
            <InfoRow
              label="Salaire net"
              value={
                renseignements.salaire_net
                  ? `CHF ${Number(renseignements.salaire_net).toLocaleString("fr-CH")}/mois`
                  : "—"
              }
            />
            {renseignements.anciennete != null && (
              <InfoRow label="Ancienneté" value={`${renseignements.anciennete} mois`} />
            )}
            {renseignements.assureur_rc && (
              <InfoRow
                label="Assurance RC"
                value={
                  renseignements.numero_police
                    ? `${renseignements.assureur_rc} · n° ${renseignements.numero_police}`
                    : renseignements.assureur_rc
                }
              />
            )}
          </dl>
        ) : (
          <p style={{ fontSize: 13, color: C.text3, margin: 0, fontStyle: "italic" }}>
            Le locataire n&apos;a pas encore saisi ses renseignements de base.
          </p>
        )}
      </div>

      {/* Documents */}
      <SectionTitle title="Documents" />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {ALL_DOC_ORDER.map((type) => (
          <DocumentTypeCard
            key={type}
            type={type}
            documents={docsOfType(type)}
            maxFichiers={maxFichiers(type)}
            isReadOnly
            isLoading={validate.isPending || reject.isPending}
            onOpen={(docId) => open.mutateAsync(docId)}
            onValidate={(docId) => validate.mutateAsync(docId)}
            onReject={(doc) => setRejectTarget(doc)}
          />
        ))}
      </div>

      {/* Cosignataires read-only */}
      <SectionTitle title="Cosignataires" />
      <CosignatairesForm cosignataires={cosignataires} readOnly />

      {/* Étape 10 : Loyer + caution versés */}
      <SectionTitle title="Versement loyer + caution" />
      <div
        style={{
          background: C.surface,
          border: `1px solid ${dossier.loyer_caution_verses ? C.green : C.border}`,
          borderRadius: 14,
          padding: "20px 24px",
          boxShadow: C.shadow,
        }}
      >
        {dossier.loyer_caution_verses ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CheckCircle2 size={22} style={{ color: C.green, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.green, margin: 0 }}>
                Versement confirmé
              </p>
              {renseignements?.loyer_caution_verses_at && (
                <p style={{ fontSize: 12, color: C.text3, margin: "2px 0 0" }}>
                  Le{" "}
                  {new Date(renseignements.loyer_caution_verses_at).toLocaleDateString(
                    "fr-CH",
                  )}
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: C.text2, margin: "0 0 14px", lineHeight: 1.5 }}>
              Une fois le premier loyer et la caution reçus, marquez cette étape
              pour finaliser le dossier à 100%.
              {!isReady && (
                <>
                  {" "}
                  <strong>
                    Disponible dès que tous les autres documents et
                    renseignements sont fournis.
                  </strong>
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => void markVerses.mutateAsync(undefined)}
              disabled={!isReady || markVerses.isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: isReady ? C.green : C.border,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: isReady && !markVerses.isPending ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}
            >
              {markVerses.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Marquer loyer + caution versés
            </button>
          </>
        )}
      </div>

      {/* Modal rejet */}
      {rejectTarget && (
        <RejectDocumentModal
          documentLabel={`${TYPE_DOCUMENT_LABELS[rejectTarget.type_document]} — ${rejectTarget.filename_original}`}
          isSubmitting={reject.isPending}
          onClose={() => setRejectTarget(null)}
          onConfirm={async (commentaire) => {
            await reject.mutateAsync({
              documentId: rejectTarget.id,
              commentaire,
            });
            setRejectTarget(null);
          }}
        />
      )}
    </>
  );
}


// ── Atoms ────────────────────────────────────────────────────────────────────


function SectionTitle({ title }: { title: string }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-serif)",
        fontSize: 18,
        color: C.text,
        margin: "28px 0 12px",
        fontWeight: 500,
      }}
    >
      {title}
    </h2>
  );
}


function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <span style={{ fontSize: 12, color: C.text3 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{value}</span>
    </div>
  );
}
