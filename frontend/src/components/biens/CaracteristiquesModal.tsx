"use client";

/**
 * Modale détaillée des caractéristiques du bien (PR-A10 + A11.A.3).
 *
 * Dual-mode controlled component :
 *   - "read"  : affichage 7 sections (Configuration, Technique, Équipements,
 *               Règles, Situation, Descriptions, Finances annexes).
 *   - "edit"  : formulaire complet PATCHable des 24+ champs caractéristiques
 *               (livré au commit suivant — squelette ici).
 *
 * Signature controlled (PR-A11.A.3) :
 *   - bienId      : UUID du bien (la modale fetche le BienDetail elle-même)
 *   - open        : visibilité (le parent contrôle l'ouverture/fermeture)
 *   - onClose     : callback de fermeture
 *   - initialMode : 'read' (défaut) | 'edit'
 */

import { Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { BienDetail } from "@/lib/types";
import { C } from "@/lib/design-tokens";
import { useBien } from "@/lib/hooks/useBiens";

type CaracMode = "read" | "edit";

interface Props {
  bienId: string;
  open: boolean;
  onClose: () => void;
  initialMode?: CaracMode;
}

const RESIDENCE_LABELS: Record<string, string> = {
  principale: "Résidence principale",
  secondaire: "Résidence secondaire",
  mixte: "Mixte (les deux)",
};

const LOCATION_LABELS: Record<string, string> = {
  annuelle: "Location annuelle",
  saisonniere: "Location saisonnière",
  semaine: "Location à la semaine",
  vide: "Bien vacant",
};

const PARKING_LABELS: Record<string, string> = {
  exterieur: "Extérieur",
  exterieur_couvert: "Extérieur couvert",
  interieur: "Intérieur",
  interieur_box: "Intérieur (box)",
};

function dpeColor(classe: string | null | undefined): string {
  if (!classe) return C.text3;
  const map: Record<string, string> = {
    A: C.green,
    B: C.green,
    C: C.amber,
    D: C.amber,
    E: C.warning,
    F: C.red,
    G: C.red,
  };
  return map[classe.toUpperCase()] || C.text;
}

function fmtCHF(n: number | null | undefined): string {
  if (n == null) return "—";
  return `CHF ${Number(n).toLocaleString("fr-CH")}`;
}

function fmtBoolYesNo(v: boolean | null | undefined): string {
  if (v === true) return "Oui";
  if (v === false) return "Non";
  return "—";
}

export function CaracteristiquesModal({
  bienId,
  open,
  onClose,
  initialMode = "read",
}: Props) {
  const { data: bien, isLoading } = useBien(bienId);
  const [mode, setMode] = useState<CaracMode>(initialMode);

  // Lorsque la modale (re)s'ouvre, on resync le mode demandé par le parent.
  useEffect(() => {
    if (open) setMode(initialMode);
  }, [open, initialMode]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          maxWidth: 760,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
        }}
      >
        <ModalHeader
          mode={mode}
          adresse={bien?.adresse}
          onSwitchToEdit={() => setMode("edit")}
          onClose={onClose}
        />

        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
          {isLoading || !bien ? (
            <p style={{ fontSize: 13, color: C.text3, textAlign: "center", padding: 32 }}>
              Chargement…
            </p>
          ) : mode === "read" ? (
            <ReadView bien={bien} />
          ) : (
            <EditView bien={bien} onCancel={() => setMode("read")} onSaved={() => setMode("read")} />
          )}
        </div>

        {mode === "read" && (
          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              padding: "12px 24px",
              display: "flex",
              justifyContent: "flex-end",
              background: "#fff",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 18px",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                background: C.surface,
                color: C.text2,
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Header dual-mode ─────────────────────────────────────────────────────────

function ModalHeader({
  mode,
  adresse,
  onSwitchToEdit,
  onClose,
}: {
  mode: CaracMode;
  adresse: string | undefined;
  onSwitchToEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        background: "#fff",
        borderBottom: `1px solid ${C.border}`,
        padding: "16px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: C.text, margin: 0 }}>
            {mode === "edit" ? "Modifier les caractéristiques" : "Caractéristiques détaillées"}
          </h2>
          {mode === "edit" && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 10px",
                borderRadius: 999,
                background: "var(--althy-gold-bg)",
                color: "var(--althy-gold-hover)",
                border: "1px solid var(--althy-gold-border)",
                whiteSpace: "nowrap",
              }}
            >
              En édition
            </span>
          )}
        </div>
        {adresse && (
          <p
            style={{
              fontSize: 13,
              color: C.text3,
              margin: "2px 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {adresse}
          </p>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {mode === "read" && (
          <button
            type="button"
            onClick={onSwitchToEdit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 9,
              border: "none",
              background: C.prussian,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Pencil size={14} />
            Modifier
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: C.text3,
            padding: 4,
            lineHeight: 0,
            flexShrink: 0,
          }}
        >
          <X size={22} />
        </button>
      </div>
    </div>
  );
}

// ── Mode Lecture (existant — polish E-24 dans commit suivant) ────────────────

function ReadView({ bien }: { bien: BienDetail }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. CONFIGURATION */}
      <Section title="Configuration">
        <Row label="Type de résidence" value={
          bien.residence_type ? RESIDENCE_LABELS[bien.residence_type] || bien.residence_type : "—"
        } />
        <Row label="Type de location" value={
          bien.location_type_actuel ? LOCATION_LABELS[bien.location_type_actuel] || bien.location_type_actuel : "—"
        } />
        <Row label="Bien meublé" value={fmtBoolYesNo(bien.is_furnished)} />
      </Section>

      {/* 2. TECHNIQUE */}
      <Section title="Caractéristiques techniques">
        <Row label="Type de bien" value={bien.type ?? "—"} />
        <Row label="Surface" value={bien.surface ? `${bien.surface} m²` : "—"} />
        <Row label="Pièces" value={bien.rooms != null ? String(bien.rooms) : "—"} />
        <Row label="Chambres" value={bien.bedrooms != null ? String(bien.bedrooms) : "—"} />
        <Row label="Salles de bain" value={bien.bathrooms != null ? String(bien.bathrooms) : "—"} />
        <Row label="Étage" value={bien.etage != null ? String(bien.etage) : "—"} />
        <Row label="Année construction" value={bien.annee_construction ? String(bien.annee_construction) : "—"} />
        <Row label="Année rénovation" value={bien.annee_renovation ? String(bien.annee_renovation) : "—"} />
        <Row
          label="Classe énergétique (DPE)"
          value={
            bien.classe_energetique ? (
              <span style={{ color: dpeColor(bien.classe_energetique), fontWeight: 700 }}>
                {bien.classe_energetique}
              </span>
            ) : "—"
          }
        />
      </Section>

      {/* 3. ÉQUIPEMENTS */}
      <Section title="Équipements">
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <EquipementBadge active={bien.has_balcony} label="Balcon" icon="🌅" />
          <EquipementBadge active={bien.has_terrace} label="Terrasse" icon="🌿" />
          <EquipementBadge active={bien.has_garden} label="Jardin" icon="🌳" />
          <EquipementBadge active={bien.has_storage} label="Cave / Réduit" icon="📦" />
          <EquipementBadge active={bien.has_fireplace} label="Cheminée" icon="🔥" />
          <EquipementBadge active={bien.has_laundry_private} label="Buanderie privée" icon="🧺" />
          <EquipementBadge active={bien.has_laundry_building} label="Buanderie commune" icon="🧺" />
          <EquipementBadge
            active={Boolean(bien.parking_type)}
            label={
              bien.parking_type
                ? `Parking — ${PARKING_LABELS[bien.parking_type] || bien.parking_type}`
                : "Parking"
            }
            icon="🚗"
          />
        </div>
      </Section>

      {/* 4. RÈGLES */}
      <Section title="Règles">
        <Row
          label="Animaux acceptés"
          value={bien.pets_allowed ? "✅ Oui" : "❌ Non"}
        />
        <Row
          label="Fumeurs acceptés"
          value={bien.smoking_allowed ? "✅ Oui" : "❌ Non"}
        />
      </Section>

      {/* 5. SITUATION */}
      <Section title="Situation géographique">
        <Row label="Distance gare" value={
          bien.distance_gare_minutes != null ? `${bien.distance_gare_minutes} min` : "—"
        } />
        <Row label="Distance arrêt bus" value={
          bien.distance_arret_bus_minutes != null ? `${bien.distance_arret_bus_minutes} min` : "—"
        } />
        <Row label="Distance télécabine" value={
          bien.distance_telecabine_minutes != null ? `${bien.distance_telecabine_minutes} min` : "—"
        } />
        <Row label="Distance lac" value={
          bien.distance_lac_minutes != null ? `${bien.distance_lac_minutes} min` : "—"
        } />
        <Row label="Distance aéroport" value={
          bien.distance_aeroport_minutes != null ? `${bien.distance_aeroport_minutes} min` : "—"
        } />
        {bien.situation_notes && (
          <div
            style={{
              marginTop: 8,
              padding: "10px 12px",
              background: C.prussianBg,
              borderRadius: 8,
              fontSize: 13,
              color: C.text2,
              fontStyle: "italic",
              lineHeight: 1.5,
            }}
          >
            {bien.situation_notes}
          </div>
        )}
      </Section>

      {/* 6. DESCRIPTIONS */}
      {(bien.description_lieu || bien.description_logement || bien.remarques) && (
        <Section title="Descriptions">
          {bien.description_lieu && (
            <DescriptionBlock label="Description du lieu" text={bien.description_lieu} />
          )}
          {bien.description_logement && (
            <DescriptionBlock label="Description du logement" text={bien.description_logement} />
          )}
          {bien.remarques && (
            <DescriptionBlock label="Remarques" text={bien.remarques} />
          )}
        </Section>
      )}

      {/* 7. FINANCES ANNEXES */}
      <Section title="Finances annexes">
        <Row label="Caution / Dépôt" value={fmtCHF(bien.deposit)} />
        <Row label="Loyer mensuel" value={fmtCHF(bien.loyer)} />
        <Row label="Charges mensuelles" value={fmtCHF(bien.charges)} />
      </Section>
    </div>
  );
}

// ── Mode Édition (squelette — implémenté au commit suivant) ──────────────────

function EditView({
  bien: _bien,
  onCancel,
  onSaved: _onSaved,
}: {
  bien: BienDetail;
  onCancel: () => void;
  onSaved: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 13, color: C.text3, fontStyle: "italic", margin: 0 }}>
        Formulaire d&apos;édition — implémenté dans le commit suivant (PR-A11.A.3).
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text2,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Annuler
        </button>
        <button
          type="button"
          disabled
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: C.prussian,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "not-allowed",
            fontFamily: "inherit",
            opacity: 0.5,
          }}
        >
          Enregistrer
        </button>
      </div>
    </div>
  );
}

// ── Composants helpers ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: 15,
          color: C.text,
          margin: "0 0 12px",
          paddingBottom: 8,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {title}
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 16,
        fontSize: 13,
      }}
    >
      <span style={{ color: C.text3 }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function EquipementBadge({
  active,
  label,
  icon,
}: {
  active: boolean | null | undefined;
  label: string;
  icon: string;
}) {
  const isActive = Boolean(active);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 8,
        fontSize: 13,
        background: isActive ? C.greenBg : C.surface2,
        border: `1px solid ${isActive ? C.green + "55" : C.border}`,
        color: isActive ? C.text : C.text3,
        opacity: isActive ? 1 : 0.6,
      }}
    >
      <span style={{ opacity: isActive ? 1 : 0.4 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {isActive && <span style={{ color: C.green, fontWeight: 700 }}>✓</span>}
    </div>
  );
}

function DescriptionBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: 11,
          color: C.text3,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: "0 0 6px",
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {text}
      </p>
    </div>
  );
}
