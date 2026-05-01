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

import { CheckCircle2, ChevronDown, ChevronRight, Pencil, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { Bien, BienDetail, BienUpdate } from "@/lib/types";
import { C } from "@/lib/design-tokens";
import { useBien, useUpdateBien } from "@/lib/hooks/useBiens";

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
  // dirty est lifted up depuis EditView pour qu'attemptClose puisse savoir
  // s'il faut demander confirmation, quel que soit le chemin de fermeture
  // (X, backdrop, Esc, bouton Annuler).
  const [editDirty, setEditDirty] = useState(false);

  // Lorsque la modale (re)s'ouvre, on resync le mode demandé par le parent
  // et on reset le suivi dirty.
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setEditDirty(false);
    }
  }, [open, initialMode]);

  // Fonction unifiée de fermeture (tous les chemins passent par ici).
  // - mode lecture : ferme directement.
  // - mode édition + form non dirty : ferme directement.
  // - mode édition + form dirty : confirmation native.
  const attemptClose = useCallback(() => {
    if (mode === "edit" && editDirty) {
      if (!window.confirm("Annuler les modifications en cours ?")) return;
    }
    setEditDirty(false);
    onClose();
  }, [mode, editDirty, onClose]);

  // Listener Escape global tant que la modale est ouverte.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, attemptClose]);

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
      onClick={(e) => {
        // On ne déclenche que si le clic est sur le backdrop lui-même,
        // pas un enfant qui aurait bubblé jusqu'ici.
        if (e.target === e.currentTarget) attemptClose();
      }}
    >
      <div
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
          onClose={attemptClose}
        />

        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
          {isLoading || !bien ? (
            <p style={{ fontSize: 13, color: C.text3, textAlign: "center", padding: 32 }}>
              Chargement…
            </p>
          ) : mode === "read" ? (
            <ReadView bien={bien} />
          ) : (
            <EditView
              bien={bien}
              onCancel={attemptClose}
              onSaved={() => {
                setEditDirty(false);
                setMode("read");
              }}
              onDirtyChange={setEditDirty}
            />
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
              onClick={attemptClose}
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

// ── Mode Lecture (PR-A11.A.3 commit 4 — polish E-24) ─────────────────────────
//
// Règle générale : on n'affiche pas les champs vides, sauf pour les champs
// canoniques structurants (Type, Surface, Pièces, Étage, DPE) où "—" reste
// explicite. Les sections optionnelles (Règles, Situation, Descriptions,
// Finances annexes) sont masquees integralement si toutes leurs valeurs
// sont null.

type EquipementItem = {
  active: boolean;
  label: string;
  icon: string;
};

function buildEquipements(bien: BienDetail): EquipementItem[] {
  return [
    { active: Boolean(bien.has_balcony), label: "Balcon", icon: "🌅" },
    { active: Boolean(bien.has_terrace), label: "Terrasse", icon: "🌿" },
    { active: Boolean(bien.has_garden), label: "Jardin", icon: "🌳" },
    { active: Boolean(bien.has_storage), label: "Cave / Réduit", icon: "📦" },
    { active: Boolean(bien.has_fireplace), label: "Cheminée", icon: "🔥" },
    { active: Boolean(bien.has_laundry_private), label: "Buanderie privée", icon: "🧺" },
    { active: Boolean(bien.has_laundry_building), label: "Buanderie commune", icon: "🧺" },
    {
      active: Boolean(bien.parking_type),
      label: bien.parking_type
        ? `Parking — ${PARKING_LABELS[bien.parking_type] || bien.parking_type}`
        : "Parking",
      icon: "🚗",
    },
  ];
}

function ReadView({ bien }: { bien: BienDetail }) {
  const [showAbsents, setShowAbsents] = useState(false);

  const equipements = buildEquipements(bien);
  const presents = equipements.filter((e) => e.active);
  const absents = equipements.filter((e) => !e.active);

  // Masques de sections optionnelles
  const showRegles = bien.pets_allowed != null || bien.smoking_allowed != null;

  const distances = [
    { label: "Distance gare", value: bien.distance_gare_minutes },
    { label: "Distance arrêt bus", value: bien.distance_arret_bus_minutes },
    { label: "Distance télécabine", value: bien.distance_telecabine_minutes },
    { label: "Distance lac", value: bien.distance_lac_minutes },
    { label: "Distance aéroport", value: bien.distance_aeroport_minutes },
  ].filter((d) => d.value != null);
  const showSituation = distances.length > 0 || Boolean(bien.situation_notes);

  const showDescriptions = Boolean(
    bien.description_lieu || bien.description_logement || bien.remarques,
  );

  const showFinances =
    bien.deposit != null || bien.loyer != null || bien.charges != null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. CONFIGURATION (champs canoniques — toujours affichés) */}
      <Section title="Configuration">
        <Row
          label="Type de résidence"
          value={
            bien.residence_type
              ? RESIDENCE_LABELS[bien.residence_type] || bien.residence_type
              : "—"
          }
        />
        <Row
          label="Type de location"
          value={
            bien.location_type_actuel
              ? LOCATION_LABELS[bien.location_type_actuel] || bien.location_type_actuel
              : "—"
          }
        />
        <Row label="Bien meublé" value={fmtBoolYesNo(bien.is_furnished)} />
      </Section>

      {/* 2. TECHNIQUE (champs canoniques — toujours affichés) */}
      <Section title="Caractéristiques techniques">
        <Row label="Type de bien" value={bien.type ?? "—"} />
        <Row label="Surface" value={bien.surface ? `${bien.surface} m²` : "—"} />
        <Row label="Pièces" value={bien.rooms != null ? String(bien.rooms) : "—"} />
        <Row label="Chambres" value={bien.bedrooms != null ? String(bien.bedrooms) : "—"} />
        <Row label="Salles de bain" value={bien.bathrooms != null ? String(bien.bathrooms) : "—"} />
        <Row label="Étage" value={bien.etage != null ? String(bien.etage) : "—"} />
        <Row
          label="Année construction"
          value={bien.annee_construction ? String(bien.annee_construction) : "—"}
        />
        <Row
          label="Année rénovation"
          value={bien.annee_renovation ? String(bien.annee_renovation) : "—"}
        />
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

      {/* 3. ÉQUIPEMENTS — Présents / Non renseignés (E-24) */}
      <Section title="Équipements">
        {presents.length === 0 ? (
          <p style={{ fontSize: 13, color: C.text3, fontStyle: "italic", margin: 0 }}>
            Aucun équipement renseigné
          </p>
        ) : (
          <>
            <p
              style={{
                fontSize: 11,
                color: C.text3,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                margin: "0 0 8px",
                fontWeight: 600,
              }}
            >
              Présents
            </p>
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              {presents.map((eq) => (
                <EquipementBadge
                  key={eq.label}
                  active
                  label={eq.label}
                  icon={eq.icon}
                />
              ))}
            </div>
          </>
        )}

        {absents.length > 0 && (
          <div style={{ marginTop: presents.length > 0 ? 16 : 8 }}>
            <button
              type="button"
              onClick={() => setShowAbsents((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: 0,
                border: "none",
                background: "none",
                color: C.text3,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              aria-expanded={showAbsents || presents.length === 0}
            >
              {showAbsents || presents.length === 0 ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
              Non renseignés ({absents.length})
            </button>
            {(showAbsents || presents.length === 0) && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "8px 0 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {absents.map((eq) => (
                  <li
                    key={eq.label}
                    style={{
                      fontSize: 13,
                      color: C.text3,
                    }}
                  >
                    {eq.label} — non renseigné
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      {/* 4. RÈGLES — masquée si tout null (E-24) */}
      {showRegles && (
        <Section title="Règles">
          {bien.pets_allowed != null && (
            <Row
              label="Animaux acceptés"
              value={bien.pets_allowed ? "Oui" : "Non"}
            />
          )}
          {bien.smoking_allowed != null && (
            <Row
              label="Fumeurs acceptés"
              value={bien.smoking_allowed ? "Oui" : "Non"}
            />
          )}
        </Section>
      )}

      {/* 5. SITUATION — masquée si tout null (E-24) */}
      {showSituation && (
        <Section title="Situation géographique">
          {distances.map((d) => (
            <Row key={d.label} label={d.label} value={`${d.value} min`} />
          ))}
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
      )}

      {/* 6. DESCRIPTIONS — masquée si tout null (E-24) */}
      {showDescriptions && (
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

      {/* 7. FINANCES ANNEXES — masquée si tout null (E-24) */}
      {showFinances && (
        <Section title="Finances annexes">
          {bien.deposit != null && (
            <Row label="Caution / Dépôt" value={fmtCHF(bien.deposit)} />
          )}
          {bien.loyer != null && (
            <Row label="Loyer mensuel" value={fmtCHF(bien.loyer)} />
          )}
          {bien.charges != null && (
            <Row label="Charges mensuelles" value={fmtCHF(bien.charges)} />
          )}
        </Section>
      )}
    </div>
  );
}

// ── Mode Édition — formulaire complet 24+ champs (PR-A11.A.3) ────────────────

const MAX_TEXT_LENGTH = 5000;
const ANNEE_MIN = 1800;
const ANNEE_MAX = new Date().getFullYear();

const TYPE_OPTIONS = [
  { value: "appartement", label: "Appartement" },
  { value: "villa", label: "Villa" },
  { value: "studio", label: "Studio" },
  { value: "maison", label: "Maison" },
  { value: "commerce", label: "Commerce" },
  { value: "bureau", label: "Bureau" },
  { value: "parking", label: "Parking" },
  { value: "garage", label: "Garage" },
  { value: "cave", label: "Cave" },
  { value: "autre", label: "Autre" },
];

const RESIDENCE_OPTIONS = [
  { value: "", label: "Non renseigné" },
  { value: "principale", label: "Résidence principale" },
  { value: "secondaire", label: "Résidence secondaire" },
  { value: "mixte", label: "Mixte (les deux)" },
];

const LOCATION_OPTIONS = [
  { value: "", label: "Non renseigné" },
  { value: "annuelle", label: "Annuelle (bail traditionnel)" },
  { value: "saisonniere", label: "Saisonnière (Airbnb, été/hiver)" },
  { value: "semaine", label: "À la semaine (vacances)" },
  { value: "vide", label: "Bien vacant" },
];

const PARKING_OPTIONS = [
  { value: "", label: "Aucun" },
  { value: "exterieur", label: "Extérieur" },
  { value: "exterieur_couvert", label: "Extérieur couvert" },
  { value: "interieur", label: "Intérieur" },
  { value: "interieur_box", label: "Intérieur (box)" },
];

const DPE_OPTIONS = [
  { value: "", label: "Non renseigné" },
  ...["A", "B", "C", "D", "E", "F", "G"].map((c) => ({ value: c, label: c })),
];

/** Forme du form interne — strings pour les inputs numériques afin de
 *  préserver le distinction "vide" vs "0", convertis au submit. */
type EditFormValues = {
  type: string;
  residence_type: string;
  location_type_actuel: string;
  is_furnished: boolean;
  surface: string;
  rooms: string;
  bedrooms: string;
  bathrooms: string;
  etage: string;
  annee_construction: string;
  annee_renovation: string;
  classe_energetique: string;
  has_balcony: boolean;
  has_terrace: boolean;
  has_garden: boolean;
  has_storage: boolean;
  has_fireplace: boolean;
  has_laundry_private: boolean;
  has_laundry_building: boolean;
  parking_type: string;
  pets_allowed: "null" | "true" | "false";
  smoking_allowed: "null" | "true" | "false";
  distance_gare_minutes: string;
  distance_arret_bus_minutes: string;
  distance_telecabine_minutes: string;
  distance_lac_minutes: string;
  distance_aeroport_minutes: string;
  situation_notes: string;
  description_lieu: string;
  description_logement: string;
  remarques: string;
  deposit: string;
  loyer: string;
  charges: string;
};

function bienToForm(bien: Bien): EditFormValues {
  const numStr = (v: number | null | undefined) =>
    v == null ? "" : String(v);
  const triState = (v: boolean | null | undefined): "null" | "true" | "false" =>
    v == null ? "null" : v ? "true" : "false";

  return {
    type: bien.type ?? "appartement",
    residence_type: bien.residence_type ?? "",
    location_type_actuel: bien.location_type_actuel ?? "",
    is_furnished: bien.is_furnished ?? false,
    surface: numStr(bien.surface),
    rooms: numStr(bien.rooms),
    bedrooms: numStr(bien.bedrooms),
    bathrooms: numStr(bien.bathrooms),
    etage: numStr(bien.etage),
    annee_construction: numStr(bien.annee_construction),
    annee_renovation: numStr(bien.annee_renovation),
    classe_energetique: bien.classe_energetique ?? "",
    has_balcony: Boolean(bien.has_balcony),
    has_terrace: Boolean(bien.has_terrace),
    has_garden: Boolean(bien.has_garden),
    has_storage: Boolean(bien.has_storage),
    has_fireplace: Boolean(bien.has_fireplace),
    has_laundry_private: Boolean(bien.has_laundry_private),
    has_laundry_building: Boolean(bien.has_laundry_building),
    parking_type: bien.parking_type ?? "",
    pets_allowed: triState(bien.pets_allowed),
    smoking_allowed: triState(bien.smoking_allowed),
    distance_gare_minutes: numStr(bien.distance_gare_minutes),
    distance_arret_bus_minutes: numStr(bien.distance_arret_bus_minutes),
    distance_telecabine_minutes: numStr(bien.distance_telecabine_minutes),
    distance_lac_minutes: numStr(bien.distance_lac_minutes),
    distance_aeroport_minutes: numStr(bien.distance_aeroport_minutes),
    situation_notes: bien.situation_notes ?? "",
    description_lieu: bien.description_lieu ?? "",
    description_logement: bien.description_logement ?? "",
    remarques: bien.remarques ?? "",
    deposit: numStr(bien.deposit),
    loyer: numStr(bien.loyer),
    charges: numStr(bien.charges),
  };
}

/** Transforme la valeur form en valeur DB type-safe (null si vide). */
function formValueToDb(
  field: keyof EditFormValues,
  value: EditFormValues[keyof EditFormValues],
): unknown {
  // Tri-state booléen
  if (field === "pets_allowed" || field === "smoking_allowed") {
    if (value === "null" || value === "") return null;
    return value === "true";
  }
  // Booléens
  if (typeof value === "boolean") return value;
  // Strings vides → null pour les selects optionnels et descriptions
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    // Champs numériques
    const numericFields: (keyof EditFormValues)[] = [
      "surface", "rooms", "bedrooms", "bathrooms", "etage",
      "annee_construction", "annee_renovation",
      "distance_gare_minutes", "distance_arret_bus_minutes",
      "distance_telecabine_minutes", "distance_lac_minutes",
      "distance_aeroport_minutes",
      "deposit", "loyer", "charges",
    ];
    if (numericFields.includes(field)) {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    return trimmed;
  }
  return value;
}

/** Calcule le diff entre les valeurs courantes et initiales. Ne retourne
 *  que les champs réellement modifiés (évite B-07 par construction). */
function computeDirty(
  current: EditFormValues,
  initial: EditFormValues,
): BienUpdate {
  const dirty: Record<string, unknown> = {};
  (Object.keys(current) as (keyof EditFormValues)[]).forEach((key) => {
    if (current[key] !== initial[key]) {
      dirty[key] = formValueToDb(key, current[key]);
    }
  });
  return dirty as BienUpdate;
}

function EditView({
  bien,
  onCancel,
  onSaved,
  onDirtyChange,
}: {
  bien: BienDetail;
  onCancel: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const update = useUpdateBien(bien.id);
  const initial = useMemo(() => bienToForm(bien), [bien]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EditFormValues>({
    defaultValues: initial,
    mode: "onBlur",
  });

  const current = watch();
  const dirty = useMemo(() => computeDirty(current, initial), [current, initial]);
  const hasDirty = Object.keys(dirty).length > 0;

  // Remonte le suivi dirty au composant racine pour que tous les chemins de
  // fermeture (backdrop, X, Esc, Annuler) passent par la confirmation unifiée.
  useEffect(() => {
    onDirtyChange(hasDirty);
  }, [hasDirty, onDirtyChange]);

  const onSubmit = handleSubmit(async () => {
    setServerError(null);
    try {
      await update.mutateAsync(dirty);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setServerError(msg ?? "Erreur lors de l'enregistrement. Réessayez.");
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
      noValidate
    >
      {serverError && (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: C.redBg,
            border: `1px solid ${C.red}55`,
            color: C.red,
            fontSize: 13,
          }}
        >
          {serverError}
        </div>
      )}

      {/* 1. Configuration */}
      <FormSection title="Configuration">
        <FormSelectField
          label="Type de résidence"
          options={RESIDENCE_OPTIONS}
          {...register("residence_type")}
        />
        <FormSelectField
          label="Type de location actuel"
          options={LOCATION_OPTIONS}
          {...register("location_type_actuel")}
        />
        <FormToggleField label="Bien meublé" {...register("is_furnished")} />
      </FormSection>

      {/* 2. Technique */}
      <FormSection title="Caractéristiques techniques">
        <FormSelectField
          label="Type de bien"
          options={TYPE_OPTIONS}
          {...register("type")}
        />
        <FormNumberField
          label="Surface"
          suffix="m²"
          step={1}
          min={0}
          error={errors.surface?.message}
          {...register("surface", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
        />
        <FormNumberField
          label="Pièces"
          step={0.5}
          min={0}
          error={errors.rooms?.message}
          {...register("rooms", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
        />
        <FormNumberField
          label="Chambres"
          step={1}
          min={0}
          error={errors.bedrooms?.message}
          {...register("bedrooms", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
        />
        <FormNumberField
          label="Salles de bain"
          step={1}
          min={0}
          error={errors.bathrooms?.message}
          {...register("bathrooms", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
        />
        <FormNumberField
          label="Étage"
          step={1}
          {...register("etage")}
        />
        <FormNumberField
          label="Année construction"
          step={1}
          min={ANNEE_MIN}
          max={ANNEE_MAX}
          error={errors.annee_construction?.message}
          {...register("annee_construction", {
            validate: (v) => {
              if (v === "") return true;
              const n = Number(v);
              if (n < ANNEE_MIN || n > ANNEE_MAX) {
                return `Entre ${ANNEE_MIN} et ${ANNEE_MAX}`;
              }
              return true;
            },
          })}
        />
        <FormNumberField
          label="Année rénovation"
          step={1}
          min={ANNEE_MIN}
          max={ANNEE_MAX}
          error={errors.annee_renovation?.message}
          {...register("annee_renovation", {
            validate: (v) => {
              if (v === "") return true;
              const n = Number(v);
              if (n < ANNEE_MIN || n > ANNEE_MAX) {
                return `Entre ${ANNEE_MIN} et ${ANNEE_MAX}`;
              }
              return true;
            },
          })}
        />
        <FormSelectField
          label="Classe énergétique (DPE)"
          options={DPE_OPTIONS}
          {...register("classe_energetique")}
        />
      </FormSection>

      {/* 3. Équipements */}
      <FormSection title="Équipements">
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <FormToggleField label="Balcon" {...register("has_balcony")} />
          <FormToggleField label="Terrasse" {...register("has_terrace")} />
          <FormToggleField label="Jardin" {...register("has_garden")} />
          <FormToggleField label="Cave / Réduit" {...register("has_storage")} />
          <FormToggleField label="Cheminée" {...register("has_fireplace")} />
          <FormToggleField label="Buanderie privée" {...register("has_laundry_private")} />
          <FormToggleField label="Buanderie commune" {...register("has_laundry_building")} />
        </div>
        <FormSelectField
          label="Parking"
          options={PARKING_OPTIONS}
          {...register("parking_type")}
        />
      </FormSection>

      {/* 4. Règles — tri-state */}
      <FormSection title="Règles">
        <FormTriStateField
          label="Animaux acceptés"
          {...register("pets_allowed")}
        />
        <FormTriStateField
          label="Fumeurs acceptés"
          {...register("smoking_allowed")}
        />
      </FormSection>

      {/* 5. Situation */}
      <FormSection title="Situation géographique">
        <FormNumberField
          label="Distance gare"
          suffix="min"
          step={1}
          min={0}
          {...register("distance_gare_minutes", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
          error={errors.distance_gare_minutes?.message}
        />
        <FormNumberField
          label="Distance arrêt bus"
          suffix="min"
          step={1}
          min={0}
          {...register("distance_arret_bus_minutes", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
          error={errors.distance_arret_bus_minutes?.message}
        />
        <FormNumberField
          label="Distance télécabine"
          suffix="min"
          step={1}
          min={0}
          {...register("distance_telecabine_minutes", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
          error={errors.distance_telecabine_minutes?.message}
        />
        <FormNumberField
          label="Distance lac"
          suffix="min"
          step={1}
          min={0}
          {...register("distance_lac_minutes", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
          error={errors.distance_lac_minutes?.message}
        />
        <FormNumberField
          label="Distance aéroport"
          suffix="min"
          step={1}
          min={0}
          {...register("distance_aeroport_minutes", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
          error={errors.distance_aeroport_minutes?.message}
        />
        <FormTextareaField
          label="Notes situation"
          rows={3}
          maxLength={MAX_TEXT_LENGTH}
          watchValue={current.situation_notes}
          {...register("situation_notes", {
            maxLength: { value: MAX_TEXT_LENGTH, message: `Max ${MAX_TEXT_LENGTH} caractères` },
          })}
          error={errors.situation_notes?.message}
        />
      </FormSection>

      {/* 6. Descriptions */}
      <FormSection title="Descriptions">
        <FormTextareaField
          label="Description du lieu"
          rows={4}
          maxLength={MAX_TEXT_LENGTH}
          watchValue={current.description_lieu}
          {...register("description_lieu", {
            maxLength: { value: MAX_TEXT_LENGTH, message: `Max ${MAX_TEXT_LENGTH} caractères` },
          })}
          error={errors.description_lieu?.message}
        />
        <FormTextareaField
          label="Description du logement"
          rows={4}
          maxLength={MAX_TEXT_LENGTH}
          watchValue={current.description_logement}
          {...register("description_logement", {
            maxLength: { value: MAX_TEXT_LENGTH, message: `Max ${MAX_TEXT_LENGTH} caractères` },
          })}
          error={errors.description_logement?.message}
        />
        <FormTextareaField
          label="Remarques"
          rows={3}
          maxLength={MAX_TEXT_LENGTH}
          watchValue={current.remarques}
          {...register("remarques", {
            maxLength: { value: MAX_TEXT_LENGTH, message: `Max ${MAX_TEXT_LENGTH} caractères` },
          })}
          error={errors.remarques?.message}
        />
      </FormSection>

      {/* 7. Finances annexes */}
      <FormSection title="Finances annexes">
        <FormNumberField
          label="Caution / Dépôt"
          suffix="CHF"
          step={10}
          min={0}
          {...register("deposit", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
          error={errors.deposit?.message}
        />
        <FormNumberField
          label="Loyer mensuel"
          suffix="CHF"
          step={10}
          min={0}
          {...register("loyer", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
          error={errors.loyer?.message}
        />
        <FormNumberField
          label="Charges mensuelles"
          suffix="CHF"
          step={10}
          min={0}
          {...register("charges", {
            validate: (v) => v === "" || Number(v) >= 0 || "Doit être positif",
          })}
          error={errors.charges?.message}
        />
      </FormSection>

      {/* Footer édition */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "#fff",
          borderTop: `1px solid ${C.border}`,
          padding: "12px 0 4px",
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        {!hasDirty && (
          <span style={{ fontSize: 12, color: C.text3, marginRight: "auto" }}>
            Aucune modification à enregistrer
          </span>
        )}
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
          type="submit"
          disabled={!hasDirty || update.isPending}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: C.prussian,
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: !hasDirty || update.isPending ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            opacity: !hasDirty || update.isPending ? 0.5 : 1,
          }}
        >
          {update.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {savedToast && <SavedToast />}
    </form>
  );
}

// ── Form sub-components ──────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
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
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: C.text3,
  marginBottom: 6,
};

const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: 9,
  padding: "9px 12px",
  fontSize: 14,
  color: C.text,
  fontFamily: "inherit",
  outline: "none",
};

const fieldErrorStyle: React.CSSProperties = {
  fontSize: 11,
  color: C.red,
  marginTop: 4,
};

type RegisterReturn = ReturnType<ReturnType<typeof useForm>["register"]>;

const FormNumberField = ({
  label,
  suffix,
  step,
  min,
  max,
  error,
  ...rest
}: {
  label: string;
  suffix?: string;
  step?: number | string;
  min?: number | string;
  max?: number | string;
  error?: string;
} & Partial<RegisterReturn>) => (
  <div>
    <label style={fieldLabelStyle}>{label}</label>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        style={{
          ...fieldInputStyle,
          flex: 1,
          borderColor: error ? C.red : C.border,
        }}
        {...(rest as Record<string, unknown>)}
      />
      {suffix && (
        <span style={{ fontSize: 12, color: C.text3, whiteSpace: "nowrap" }}>
          {suffix}
        </span>
      )}
    </div>
    {error && <p style={fieldErrorStyle}>{error}</p>}
  </div>
);

const FormSelectField = ({
  label,
  options,
  ...rest
}: {
  label: string;
  options: { value: string; label: string }[];
} & Partial<RegisterReturn>) => (
  <div>
    <label style={fieldLabelStyle}>{label}</label>
    <select
      style={{ ...fieldInputStyle, cursor: "pointer" }}
      {...(rest as Record<string, unknown>)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const FormToggleField = ({
  label,
  ...rest
}: {
  label: string;
} & Partial<RegisterReturn>) => (
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 12px",
      borderRadius: 9,
      border: `1px solid ${C.border}`,
      background: C.surface,
      cursor: "pointer",
      fontSize: 14,
      color: C.text,
    }}
  >
    <input
      type="checkbox"
      style={{
        width: 16,
        height: 16,
        accentColor: C.prussian,
        cursor: "pointer",
      }}
      {...(rest as Record<string, unknown>)}
    />
    {label}
  </label>
);

const FormTriStateField = ({
  label,
  name,
  onChange,
  onBlur,
  ref,
}: {
  label: string;
} & Partial<RegisterReturn>) => (
  <div>
    <label style={fieldLabelStyle}>{label}</label>
    <div style={{ display: "flex", gap: 16, fontSize: 14, color: C.text }}>
      {[
        { v: "null", l: "Non renseigné" },
        { v: "true", l: "Autorisés" },
        { v: "false", l: "Interdits" },
      ].map((opt) => (
        <label
          key={opt.v}
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
        >
          <input
            type="radio"
            name={name}
            value={opt.v}
            onChange={onChange}
            onBlur={onBlur}
            ref={ref}
            style={{ accentColor: C.prussian, cursor: "pointer" }}
          />
          {opt.l}
        </label>
      ))}
    </div>
  </div>
);

const FormTextareaField = ({
  label,
  rows,
  maxLength,
  watchValue,
  error,
  ...rest
}: {
  label: string;
  rows: number;
  maxLength: number;
  watchValue: string;
  error?: string;
} & Partial<RegisterReturn>) => {
  const len = (watchValue ?? "").length;
  const overLimit = len > maxLength;
  return (
    <div>
      <label style={fieldLabelStyle}>{label}</label>
      <textarea
        rows={rows}
        style={{
          ...fieldInputStyle,
          resize: "vertical",
          fontFamily: "inherit",
          borderColor: error || overLimit ? C.red : C.border,
        }}
        {...(rest as Record<string, unknown>)}
      />
      <p
        style={{
          fontSize: 11,
          color: overLimit ? C.red : C.text3,
          marginTop: 4,
          textAlign: "right",
        }}
      >
        {len} / {maxLength}
      </p>
      {error && <p style={fieldErrorStyle}>{error}</p>}
    </div>
  );
};

function SavedToast() {
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: C.text,
        color: "#fff",
        padding: "10px 20px",
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 600,
        zIndex: 9999,
        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <CheckCircle2 size={16} />
      Modifications enregistrées
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
