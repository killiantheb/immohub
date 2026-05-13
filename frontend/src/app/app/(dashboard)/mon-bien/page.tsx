"use client";

/**
 * Mon espace locataire — Sprint 1C (remplace placeholder Sprint 1A).
 *
 * Phase 1.0 doctrine v6 §4.7 — vue lecture seule SON bien :
 *   - Header bien : photo cover + adresse + ville + type
 *   - Sections "à venir Sprint 1D" pour bail / paiements / documents / messagerie
 *
 * Sécurité :
 *   - DashboardLayoutClient.tsx restreint /app/mon-bien à ["locataire",
 *     "super_admin"] (Sprint 1A).
 *   - Backend BienService.list() filtre par Locataire.user_id == current_user.id
 *     (Sprint 1A guard) → GET /biens retourne uniquement le bien lié.
 *
 * Edge case : si locataire pas encore lié à un bien (invitation pas consommée
 * ou DB drift), on affiche un état "pas encore lié" avec lien contact.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Banknote, CheckCircle, ClipboardCheck, Download, FileText, Home, MapPin, MessageSquare, PenLine } from "lucide-react";
import { useBiensList } from "@/lib/hooks/useBiens";
import { useMyContract } from "@/lib/hooks/useContracts";
import { useRole } from "@/lib/hooks/useRole";
import { ConversationBien } from "@/components/messagerie/ConversationBien";
import { CountersignModal } from "@/components/contracts/CountersignModal";
import { C } from "@/lib/design-tokens";

export default function MonBienPage() {
  const router = useRouter();
  const { role } = useRole();
  const { data, isLoading, isError } = useBiensList({ page: 1, size: 1 });

  // Defense in depth — DashboardLayoutClient devrait déjà rediriger, mais on
  // garde un fallback si race condition role pas encore chargé.
  useEffect(() => {
    if (role && role !== "locataire" && role !== "super_admin") {
      router.replace("/app");
    }
  }, [role, router]);

  if (isLoading) {
    return (
      <div style={{ padding: 32, maxWidth: 880, margin: "0 auto" }}>
        <Skeleton h={220} />
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <Skeleton h={140} />
          <Skeleton h={140} />
          <Skeleton h={140} />
          <Skeleton h={140} />
        </div>
      </div>
    );
  }

  const bien = data?.items?.[0];

  if (isError || !bien) {
    return <NotLinkedState />;
  }

  const adresseComplete = [bien.adresse, [bien.cp, bien.ville].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const coverImg = bien.images?.find((img) => img.is_cover)?.url ?? bien.images?.[0]?.url;

  return (
    <div style={{ padding: "24px 32px 48px", maxWidth: 880, margin: "0 auto" }}>
      {/* ── Header bien ─────────────────────────────────────────────────── */}
      <section
        style={{
          background: C.surface,
          borderRadius: 14,
          border: `1px solid ${C.border}`,
          boxShadow: C.shadow,
          overflow: "hidden",
          marginBottom: 24,
        }}
      >
        {/* Cover image OR gradient fallback */}
        <div
          style={{
            height: 220,
            background: coverImg
              ? `url(${coverImg}) center/cover`
              : `linear-gradient(135deg, ${C.prussian} 0%, #1A4670 100%)`,
            position: "relative",
          }}
        >
          {!coverImg && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.gold,
                opacity: 0.4,
              }}
            >
              <Home size={56} />
            </div>
          )}
        </div>

        {/* Info bien */}
        <div style={{ padding: "24px 28px" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: C.gold,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              margin: "0 0 8px",
            }}
          >
            Votre logement
          </p>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 26,
              fontWeight: 400,
              color: C.text,
              margin: "0 0 12px",
              letterSpacing: "0.01em",
            }}
          >
            {bien.building_name || bien.adresse || "Mon logement"}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.text2, fontSize: 14 }}>
            <MapPin size={14} style={{ color: C.text3 }} />
            <span>{adresseComplete || "Adresse non renseignée"}</span>
          </div>

          {/* Mini-grid caractéristiques */}
          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 14,
              paddingTop: 18,
              borderTop: `1px solid ${C.border}`,
            }}
          >
            {bien.type && <MiniInfo label="Type" value={bien.type} />}
            {bien.surface != null && <MiniInfo label="Surface" value={`${bien.surface} m²`} />}
            {bien.rooms != null && <MiniInfo label="Pièces" value={String(bien.rooms)} />}
            {bien.canton && <MiniInfo label="Canton" value={bien.canton} />}
          </div>
        </div>
      </section>

      {/* ── Section "Mon dossier" (PR Sprint 1B — Module Dossier Locataire) ── */}
      <Link
        href="/app/mon-bien/dossier"
        style={{
          display: "block",
          textDecoration: "none",
          background: C.surface,
          border: `1px solid ${C.prussianBorder}`,
          borderRadius: 12,
          padding: 20,
          boxShadow: C.shadow,
          marginBottom: 16,
          transition: "transform 0.15s, box-shadow 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: C.prussianBg,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ClipboardCheck size={22} style={{ color: C.prussian }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 16,
                fontWeight: 500,
                color: C.text,
                margin: "0 0 4px",
              }}
            >
              Mon dossier locataire
            </h3>
            <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.4, margin: 0 }}>
              Complétez votre dossier pour recevoir vos clés. Documents requis, renseignements, cosignataires.
            </p>
          </div>
          <ArrowRight size={18} style={{ color: C.prussian, flexShrink: 0 }} />
        </div>
      </Link>

      {/* ── Mon bail (Sprint 8 Lot C — workflow contre-signature locataire) ─── */}
      <div style={{ marginBottom: 16 }}>
        <MonBailSection />
      </div>

      {/* ── Sections "à venir Sprint 1D" ─────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        <ComingCard
          icon={Banknote}
          title="Mes paiements"
          description="L'historique de vos loyers et leur statut (payé/en attente) sera disponible Phase 1.1."
        />
      </div>

      {/* ── Messagerie 1:1 bailleur ↔ locataire (§4.13 Phase 1.0) ────────── */}
      <section
        aria-label="Messagerie avec votre bailleur"
        style={{ marginTop: 24 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <MessageSquare size={16} style={{ color: C.prussian }} />
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 18,
              fontWeight: 500,
              color: C.text,
              margin: 0,
              letterSpacing: "0.01em",
            }}
          >
            Messagerie
          </h2>
        </div>
        <ConversationBien
          bienId={bien.id}
          locataireView={{ recipientUserId: bien.owner_id }}
        />
      </section>

      <p
        style={{
          fontSize: 12,
          color: C.text3,
          textAlign: "center",
          margin: "32px 0 0",
          lineHeight: 1.5,
        }}
      >
        Phase 1.0 — votre espace s&apos;enrichira progressivement.
      </p>
    </div>
  );
}

// ── Atoms ───────────────────────────────────────────────────────────────────

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: C.text3,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          margin: "0 0 4px",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 14, fontWeight: 500, color: C.text, margin: 0 }}>{value}</p>
    </div>
  );
}

function ComingCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 20,
        boxShadow: C.shadow,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: C.prussianBg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Icon size={18} style={{ color: C.prussian }} />
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 16,
          fontWeight: 500,
          color: C.text,
          margin: "0 0 6px",
        }}
      >
        {title}
      </h3>
      <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, margin: 0 }}>{description}</p>
      <p
        style={{
          fontSize: 11,
          color: C.text3,
          margin: "10px 0 0",
          letterSpacing: "0.04em",
        }}
      >
        Bientôt disponible
      </p>
    </div>
  );
}

function Skeleton({ h = 100 }: { h?: number }) {
  return (
    <div
      style={{
        height: h,
        borderRadius: 12,
        background: C.border,
        opacity: 0.5,
      }}
    />
  );
}

// ── Mon bail (Sprint 8 Lot C) ───────────────────────────────────────────────

function MonBailSection() {
  const { contract, isLoading } = useMyContract();
  const [modalOpen, setModalOpen] = useState(false);

  if (isLoading) {
    return <Skeleton h={180} />;
  }

  if (!contract) {
    return (
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 20,
          boxShadow: C.shadow,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: C.prussianBg,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <FileText size={18} style={{ color: C.prussian }} />
        </div>
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 16,
            fontWeight: 500,
            color: C.text,
            margin: "0 0 6px",
          }}
        >
          Mon bail
        </h3>
        <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.5, margin: 0 }}>
          Aucun bail actif. Votre bailleur préparera le document dès que possible.
        </p>
      </div>
    );
  }

  const needsCountersign = Boolean(contract.signed_at) && !contract.tenant_signed_at;
  const isFullySigned = Boolean(contract.fully_signed);

  return (
    <section
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 24,
        boxShadow: C.shadow,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: C.prussianBg,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <FileText size={18} style={{ color: C.prussian }} />
        </div>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 18,
            fontWeight: 500,
            color: C.text,
            margin: 0,
          }}
        >
          Mon bail
        </h2>
      </div>

      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 18 }}>
        <BailRow
          label="Date d'entrée"
          value={formatDate(contract.start_date)}
        />
        <BailRow
          label="Date de sortie"
          value={contract.end_date ? formatDate(contract.end_date) : "Bail à durée indéterminée"}
        />
        <BailRow
          label="Loyer mensuel"
          value={formatCHF(contract.monthly_rent)}
        />
        <BailRow
          label="Charges"
          value={formatCHF(contract.charges)}
        />
        <BailRow
          label="Dépôt de garantie"
          value={formatCHF(contract.deposit)}
        />
        <BailRow
          label="Bailleur"
          value={contract.signed_at ? `Accepté le ${formatDate(contract.signed_at)}` : "En attente"}
        />
      </dl>

      {isFullySigned && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: C.greenBg,
            border: `1px solid ${C.green}`,
            color: C.green,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          <CheckCircle size={16} />
          Bail actif depuis le {formatDate(contract.tenant_signed_at)}
        </div>
      )}

      {needsCountersign && (
        <div
          style={{
            background: C.prussianBg,
            border: `1px solid ${C.prussianBorder}`,
            color: C.prussian,
            borderRadius: 10,
            padding: "12px 14px",
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          Votre bailleur a accepté le bail. Lisez attentivement le document puis
          contre-signez pour activer le contrat.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {needsCountersign && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: C.prussian,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <PenLine size={14} />
            Lire et contre-signer le bail
          </button>
        )}
        {contract.pdf_url && (
          <a
            href={contract.pdf_url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text2,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Download size={14} />
            Télécharger le bail PDF
          </a>
        )}
      </div>

      {modalOpen && (
        <CountersignModal
          contract={contract}
          onClose={() => setModalOpen(false)}
        />
      )}
    </section>
  );
}

function BailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: C.text3,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          margin: "0 0 4px",
        }}
      >
        {label}
      </dt>
      <dd style={{ fontSize: 14, fontWeight: 500, color: C.text, margin: 0 }}>{value}</dd>
    </div>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "long", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatCHF(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `CHF ${amount.toLocaleString("fr-CH")}`;
}

function NotLinkedState() {
  return (
    <div style={{ padding: "48px 32px", maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: C.prussianBg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 18,
        }}
      >
        <Home size={26} style={{ color: C.prussian }} />
      </div>
      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 22,
          fontWeight: 400,
          color: C.text,
          margin: "0 0 12px",
        }}
      >
        Votre logement n&apos;est pas encore lié
      </h1>
      <p
        style={{
          fontSize: 14,
          color: C.text2,
          lineHeight: 1.6,
          margin: "0 0 24px",
        }}
      >
        Votre espace est prêt mais aucun bien n&apos;est encore rattaché à votre compte.
        Si vous venez de créer votre compte via une invitation, ce lien devrait apparaître
        d&apos;ici quelques secondes — sinon contactez votre bailleur.
      </p>
      <a
        href="/app/mon-bien"
        style={{
          display: "inline-block",
          padding: "10px 24px",
          borderRadius: 10,
          background: C.prussian,
          color: "#fff",
          textDecoration: "none",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Actualiser
      </a>
    </div>
  );
}
