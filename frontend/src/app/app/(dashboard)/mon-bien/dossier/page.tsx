"use client";

/**
 * Mon dossier — page locataire Module Dossier Phase 1.0 (Sprint 1B).
 *
 * Récupère son locataire (GET /locataires/me) puis le dossier complet
 * (progression + documents + breakdown). Affiche :
 *   - Banner warning si progression < 70%
 *   - DossierProgressionBar
 *   - Étape 1 : RenseignementsForm (15%)
 *   - Étape 2 : 7 DocumentTypeCard (locataire-uploadable types)
 *   - Étape 9 (read-only) : bail_signe (uploadé par bailleur Sprint 3)
 *   - Étape 10 (read-only) : versement loyer/caution (bailleur)
 *   - CosignatairesForm (Sprint 1A.5)
 *   - Banner discret « Mode colocation : bientôt »
 *
 * Doctrine :
 *   - §4.7 espace locataire dédié à SON bien (RLS Postgres + backend guard)
 *   - §B.4 palette Prussian/Or stricte
 *   - §B.10 empty states honnêtes, statuts visibles
 */

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  FileSignature,
  KeyRound,
  PartyPopper,
} from "lucide-react";

import { CosignatairesForm } from "@/components/dossier/CosignatairesForm";
import { DocumentTypeCard } from "@/components/dossier/DocumentTypeCard";
import { DossierProgressionBar } from "@/components/dossier/DossierProgressionBar";
import { PropositionLocataireSection } from "@/components/dossier/PropositionLocataireSection";
import { RenseignementsForm } from "@/components/dossier/RenseignementsForm";
import {
  MAX_FICHIERS_PAR_TYPE,
  type TypeDocument,
} from "@/lib/api/dossier-documents";
import {
  useDossierDocuments,
  useDeleteDocument,
  useMyLocataire,
  useOpenDocument,
  useUpdateCosignataires,
  useUpdateRenseignements,
  useUploadDocument,
} from "@/lib/hooks/useDossierDocuments";
import { useProposition } from "@/lib/hooks/useProposition";
import { C } from "@/lib/design-tokens";


// Ordre d'affichage des cards documents côté locataire (sans bail_signe = bailleur)
const LOCATAIRE_DOC_ORDER: readonly TypeDocument[] = [
  "piece_identite",
  "permis_sejour",
  "contrat_travail",
  "fiches_salaire",
  "assurance_rc",
  "caution",
  "extrait_poursuites",
];


export default function MonDossierPage() {
  const router = useRouter();
  const myLocataireQuery = useMyLocataire();
  const locataireId = myLocataireQuery.data?.id;
  const dossierQuery = useDossierDocuments(locataireId);
  const propositionQuery = useProposition(locataireId);

  // Mutations (instanciées avec une string vide quand locataireId absent —
  // jamais appelées dans ce cas car le rendu se fait après vérif locataireId).
  const safeId = locataireId ?? "";
  const upload = useUploadDocument(safeId);
  const remove = useDeleteDocument(safeId);
  const open = useOpenDocument();
  const updateRens = useUpdateRenseignements(safeId);
  const updateCosig = useUpdateCosignataires(safeId);

  // ── States d'erreur globale ─────────────────────────────────────────────────

  if (myLocataireQuery.isLoading || dossierQuery.isLoading) {
    return (
      <PageShell>
        <p style={{ color: C.text3, textAlign: "center", padding: 40 }}>Chargement…</p>
      </PageShell>
    );
  }

  if (myLocataireQuery.isError && (myLocataireQuery.error as { response?: { status?: number } })?.response?.status === 404) {
    return (
      <PageShell>
        <EmptyState
          title="Aucun dossier trouvé"
          message="Aucun bien n'est rattaché à votre compte. Si vous venez de créer votre compte via une invitation, attendez quelques secondes puis rafraîchissez."
          ctaLabel="Retour à mon bien"
          ctaHref="/app/mon-bien"
        />
      </PageShell>
    );
  }

  if (!locataireId || !dossierQuery.data) {
    return (
      <PageShell>
        <EmptyState
          title="Erreur de chargement"
          message="Impossible de charger votre dossier. Réessayez dans quelques instants ou contactez le support."
          ctaLabel="Retour à mon bien"
          ctaHref="/app/mon-bien"
        />
      </PageShell>
    );
  }

  const dossier = dossierQuery.data;
  const cosignataires = myLocataireQuery.data?.cosignataires ?? [];

  // ── Helpers de rendu ────────────────────────────────────────────────────────

  function docsOfType(type: TypeDocument) {
    return dossier.documents.filter((d) => d.type_document === type);
  }

  function maxFichiers(type: TypeDocument) {
    return MAX_FICHIERS_PAR_TYPE[type] ?? 1;
  }

  return (
    <PageShell>
      <button
        type="button"
        onClick={() => router.push("/app/mon-bien")}
        style={backBtnStyle}
      >
        <ArrowLeft size={14} />
        Retour à mon bien
      </button>

      {/* ── Banner 100% (Sprint 3 : dossier complet, locataire officiel) ────── */}
      {dossier.progression === 100 && (
        <div
          role="status"
          style={{
            display: "flex",
            gap: 14,
            padding: "18px 22px",
            background: C.greenBg,
            border: `1px solid ${C.green}`,
            borderRadius: 14,
            marginBottom: 20,
            boxShadow: C.shadow,
          }}
        >
          <PartyPopper size={26} style={{ color: C.green, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.green, margin: "0 0 4px" }}>
              Félicitations ! Votre dossier est complet à 100%.
            </p>
            <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
              <KeyRound size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              Vous êtes officiellement locataire. Votre bailleur vous remettra
              les clés très prochainement.
            </p>
          </div>
        </div>
      )}

      {/* ── Banner warning si < 100% (Sprint 1B.1 : 100% strict) ────────────── */}
      {dossier.progression < 100 && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 12,
            padding: "14px 18px",
            background: C.prussianBg,
            border: `1px solid ${C.prussianBorder}`,
            borderRadius: 12,
            marginBottom: 20,
          }}
        >
          <AlertTriangle size={20} style={{ color: C.prussian, flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>
              Action requise — Complétez votre dossier
            </p>
            <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>
              Vous devez compléter votre dossier à <strong>100%</strong> pour
              finaliser votre location. Pas encore tous les documents finaux ?
              Vous pouvez fournir un équivalent temporaire (mail d&apos;attente,
              attestation en cours, etc.) en cochant la case correspondante sur
              chaque section.
            </p>
          </div>
        </div>
      )}

      {/* ── Progression ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <DossierProgressionBar progression={dossier.progression} />
      </div>

      {/* ── Étape 0 : Proposition de dates + préférences (Sprint 4B) ─────────── */}
      {propositionQuery.data && (
        <>
          <div
            style={{
              margin: "28px 0 12px",
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span
              aria-hidden
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.gold,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Avant de commencer
            </span>
            <h2
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: 19,
                color: C.text,
                margin: 0,
                fontWeight: 500,
              }}
            >
              Vos préférences et dates d&apos;entrée
            </h2>
          </div>
          <PropositionLocataireSection
            locataireId={locataireId}
            proposition={propositionQuery.data}
          />
        </>
      )}

      {/* ── Étape 1 : Renseignements ─────────────────────────────────────────── */}
      <SectionTitle index={1} title="Renseignements de base" weight={15} />
      <RenseignementsForm
        dossier={dossier.dossier}
        isSubmitting={updateRens.isPending}
        onSubmit={(payload) => updateRens.mutateAsync(payload)}
      />

      {/* ── Étape 2 : Documents à fournir ────────────────────────────────────── */}
      <SectionTitle index={2} title="Documents à fournir" />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {LOCATAIRE_DOC_ORDER.map((type) => (
          <DocumentTypeCard
            key={type}
            type={type}
            documents={docsOfType(type)}
            maxFichiers={maxFichiers(type)}
            isReadOnly={false}
            isLoading={upload.isPending || remove.isPending}
            onUpload={(payload) => upload.mutateAsync(payload)}
            onDelete={(docId) => remove.mutateAsync(docId)}
            onOpen={(docId) => open.mutateAsync(docId)}
          />
        ))}
      </div>

      {/* ── Étape 9 : Bail signé (uploadé par le bailleur Sprint 3) ──────────── */}
      <SectionTitle index={9} title="Bail signé" weight={10} />
      {(() => {
        const bailDocs = docsOfType("bail_signe");
        const hasBail = bailDocs.length > 0;
        return (
          <ReadOnlyStepCard
            icon={FileSignature}
            ok={hasBail}
            title={
              hasBail
                ? "Bail signé disponible"
                : "En attente du bail signé par votre bailleur"
            }
            message={
              hasBail
                ? "Votre bailleur a déposé le bail signé. Vous pouvez le consulter et le télécharger ci-dessous."
                : "Une fois votre dossier complété, votre bailleur déposera ici le bail signé. Vous serez notifié."
            }
            documents={bailDocs}
            onOpenDocument={(docId) => open.mutateAsync(docId)}
          />
        );
      })()}

      {/* ── Étape 10 : Versement loyer + caution (read-only) ─────────────────── */}
      <SectionTitle index={10} title="Versement loyer + caution" weight={5} />
      <ReadOnlyStepCard
        icon={Clock}
        title={
          dossier.loyer_caution_verses
            ? "Versement confirmé par votre bailleur"
            : "En attente — Versement à effectuer"
        }
        message={
          dossier.loyer_caution_verses
            ? dossier.dossier?.loyer_caution_verses_at
              ? `Votre bailleur a confirmé la réception le ${new Date(
                  dossier.dossier.loyer_caution_verses_at,
                ).toLocaleDateString("fr-CH")}.`
              : "Votre bailleur a confirmé la réception du premier loyer et de la caution."
            : "Cette étape sera marquée par votre bailleur après réception du premier loyer et de la caution."
        }
        ok={dossier.loyer_caution_verses}
      />

      {/* ── Cosignataires ────────────────────────────────────────────────────── */}
      <div style={{ margin: "28px 0 12px" }}>
        <p
          style={{
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontSize: 18,
            color: C.text,
            margin: 0,
            fontWeight: 500,
          }}
        >
          Cosignataires (optionnel)
        </p>
        <p style={{ fontSize: 12, color: C.text3, margin: "4px 0 0" }}>
          Membres de votre foyer qui résident dans ce logement
        </p>
      </div>
      <CosignatairesForm
        cosignataires={cosignataires}
        isSubmitting={updateCosig.isPending}
        onSubmit={(next) => updateCosig.mutateAsync(next)}
      />

      {/* ── Banner coloc Phase 1.1 ───────────────────────────────────────────── */}
      <div
        style={{
          marginTop: 24,
          padding: "12px 16px",
          background: C.surface2,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          fontSize: 12,
          color: C.text3,
          textAlign: "center",
        }}
      >
        Mode colocation (plusieurs locataires avec comptes séparés) — bientôt disponible.
      </div>
    </PageShell>
  );
}


// ── Atoms ────────────────────────────────────────────────────────────────────


function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "24px 24px 48px", maxWidth: 880, margin: "0 auto" }}>
      {children}
    </div>
  );
}


function SectionTitle({ index, title, weight }: { index: number; title: string; weight?: number }) {
  return (
    <div
      style={{
        margin: "28px 0 12px",
        display: "flex",
        alignItems: "baseline",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.gold,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Étape {index}
      </span>
      <h2
        style={{
          fontFamily: "var(--font-serif, Georgia, serif)",
          fontSize: 19,
          color: C.text,
          margin: 0,
          fontWeight: 500,
        }}
      >
        {title}
      </h2>
      {weight !== undefined && (
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
          {weight}%
        </span>
      )}
    </div>
  );
}


function ReadOnlyStepCard({
  icon: Icon,
  title,
  message,
  ok = false,
  documents,
  onOpenDocument,
}: {
  icon: React.ElementType;
  title: string;
  message: string;
  ok?: boolean;
  documents?: { id: string; filename_original: string; created_at: string }[];
  onOpenDocument?: (documentId: string) => Promise<unknown> | void;
}) {
  const accentColor = ok ? C.green : C.text3;
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "18px 20px",
        boxShadow: C.shadow,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: ok ? C.greenBg : C.surface2,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {ok ? (
          <CheckCircle2 size={18} style={{ color: C.green }} />
        ) : (
          <Icon size={18} style={{ color: C.prussian }} />
        )}
      </div>
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: accentColor,
            margin: "0 0 4px",
          }}
        >
          {title}
        </p>
        <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, margin: 0 }}>{message}</p>
        {documents && documents.length > 0 && (
          <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {documents.map((d) => (
              <li
                key={d.id}
                style={{
                  fontSize: 12,
                  color: C.text2,
                  padding: "8px 12px",
                  background: C.surface2,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.filename_original} ·{" "}
                  {new Date(d.created_at).toLocaleDateString("fr-CH")}
                </span>
                {onOpenDocument && (
                  <button
                    type="button"
                    onClick={() => void onOpenDocument(d.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: `1px solid ${C.border}`,
                      background: C.surface,
                      color: C.text2,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    <Eye size={12} />
                    Voir le bail
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


function EmptyState({
  title,
  message,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "48px 24px",
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-serif, Georgia, serif)",
          fontSize: 22,
          color: C.text,
          margin: "0 0 12px",
          fontWeight: 400,
        }}
      >
        {title}
      </h1>
      <p style={{ fontSize: 14, color: C.text2, margin: "0 0 24px", lineHeight: 1.5 }}>
        {message}
      </p>
      <a
        href={ctaHref}
        style={{
          display: "inline-block",
          padding: "10px 22px",
          borderRadius: 10,
          background: C.prussian,
          color: "#fff",
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {ctaLabel}
      </a>
    </div>
  );
}


const backBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text2,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  marginBottom: 16,
};
