"use client";

/**
 * Modale fullscreen — Caractéristiques bien (PR-A11.A.6.c).
 *
 * Refonte intégrale du composant A11.A.4 :
 *   - 7 tabs horizontaux (Identité / Localisation / Surface & Annexes /
 *     Caractéristiques techniques / Conditions location / Contacts /
 *     Fiscalité & Description)
 *   - Édition inline pattern Notion (clic champ → input → blur/Enter
 *     → save auto via PATCH /biens/{id})
 *   - Optimistic update via `useUpdateBien` existant
 *   - Indicateur visuel pendant la sauvegarde (spinner) + checkmark fugace
 *
 * Aligné `docs/4-PRODUIT.md` §4.2 (édition inline pattern Notion) et
 * `docs/3-ARCHITECTURE.md` §3.6 (DA scientifique) + §3.12 (modale
 * fullscreen pour entité elle-même).
 *
 * Signature controlled (préservée depuis A11.A.3) :
 *   - bienId      : UUID du bien (la modale fetche le BienDetail elle-même)
 *   - open        : visibilité (le parent contrôle l'ouverture/fermeture)
 *   - onClose     : callback de fermeture
 *   - initialMode : conservé pour rétrocompat call site (no-op depuis 6.c —
 *                   la modale n'a plus qu'un mode "lecture interactive
 *                   inline" ; la prop est ignorée).
 */

import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnnexesSection } from "./AnnexesSection";
import { ContactsSection } from "./ContactsSection";
import { CompteursSection } from "./CompteursSection";
import { FieldLabel } from "./FieldLabel";
import { KeysSection } from "./KeysSection";
import { useBien, useUpdateBien } from "@/lib/hooks/useBiens";
import type { BienDetail, BienUpdate } from "@/lib/types";
import { C } from "@/lib/design-tokens";

type TabId =
  | "identite"
  | "localisation"
  | "surface"
  | "technique"
  | "location"
  | "contacts"
  | "fiscalite";

const TABS: { id: TabId; label: string }[] = [
  { id: "identite", label: "Identité" },
  { id: "localisation", label: "Localisation" },
  { id: "surface", label: "Surface & Annexes" },
  { id: "technique", label: "Caractéristiques techniques" },
  { id: "location", label: "Conditions location" },
  { id: "contacts", label: "Contacts" },
  { id: "fiscalite", label: "Fiscalité & Description" },
];

interface Props {
  bienId: string;
  open: boolean;
  onClose: () => void;
  /** No-op depuis A11.A.6.c — préservé pour rétrocompat call site. */
  initialMode?: "read" | "edit";
}

// ── Contexte d'édition partagé entre le shell modale et les tabs ────────────

interface EditContext {
  bien: BienDetail;
  pendingFields: Set<string>;
  justSavedFields: Set<string>;
  errorFields: Map<string, string>;
  save: (field: string, value: unknown) => Promise<void>;
}

export function CaracteristiquesModal({ bienId, open, onClose }: Props) {
  const { data: bien, isLoading } = useBien(bienId);
  const update = useUpdateBien(bienId);

  const [activeTab, setActiveTab] = useState<TabId>("identite");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [justSaved, setJustSaved] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  // Reset transient state à chaque ouverture.
  useEffect(() => {
    if (open) {
      setPending(new Set());
      setJustSaved(new Set());
      setErrors(new Map());
    }
  }, [open]);

  const save = useCallback(
    async (field: string, value: unknown) => {
      setPending((s) => new Set(s).add(field));
      setErrors((m) => {
        const next = new Map(m);
        next.delete(field);
        return next;
      });
      try {
        await update.mutateAsync({ [field]: value } as BienUpdate);
        setJustSaved((s) => new Set(s).add(field));
        setTimeout(() => {
          setJustSaved((s) => {
            const next = new Set(s);
            next.delete(field);
            return next;
          });
        }, 1200);
      } catch (err) {
        const detail =
          (err as { response?: { data?: { detail?: string } } })?.response?.data
            ?.detail ?? "Erreur lors de la sauvegarde";
        setErrors((m) => new Map(m).set(field, detail));
      } finally {
        setPending((s) => {
          const next = new Set(s);
          next.delete(field);
          return next;
        });
      }
    },
    [update],
  );

  const attemptClose = useCallback(() => {
    if (pending.size > 0) {
      const ok = window.confirm(
        "Une sauvegarde est en cours. Fermer quand même ?",
      );
      if (!ok) return;
    }
    onClose();
  }, [pending.size, onClose]);

  // ESC + scroll lock body
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, attemptClose]);

  if (!open) return null;

  const ctx: EditContext | null = bien
    ? {
        bien,
        pendingFields: pending,
        justSavedFields: justSaved,
        errorFields: errors,
        save,
      }
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Caractéristiques du bien"
      style={backdropStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) attemptClose();
      }}
    >
      <div style={shellStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <h2 style={titleStyle}>Caractéristiques détaillées</h2>
            {bien && (
              <p style={subtitleStyle}>
                {bien.adresse}, {bien.cp} {bien.ville}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Fermer"
            style={closeBtnStyle}
          >
            <X size={22} />
          </button>
        </div>

        {/* Tabs nav */}
        <nav style={tabsNavStyle} role="tablist" aria-label="Sections">
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
                className={active ? "carac-tab-active" : undefined}
                style={{
                  ...tabBtnStyle,
                  color: active ? C.prussian : C.text3,
                  fontWeight: active ? 600 : 500,
                  borderBottom: `2px solid ${active ? C.gold : "transparent"}`,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div style={bodyStyle}>
          {isLoading || !ctx ? (
            <p style={loadingStyle}>Chargement…</p>
          ) : (
            <TabContent tabId={activeTab} ctx={ctx} bienId={bienId} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab dispatcher ──────────────────────────────────────────────────────────

function TabContent({
  tabId,
  ctx,
  bienId,
}: {
  tabId: TabId;
  ctx: EditContext;
  bienId: string;
}) {
  switch (tabId) {
    case "identite":
      return <TabIdentite ctx={ctx} bienId={bienId} />;
    case "localisation":
      return <TabLocalisation ctx={ctx} />;
    case "surface":
      return <TabSurface ctx={ctx} bienId={bienId} />;
    case "technique":
      return <TabTechnique ctx={ctx} bienId={bienId} />;
    case "location":
      return <TabLocation ctx={ctx} />;
    case "contacts":
      return <ContactsSection bienId={bienId} />;
    case "fiscalite":
      return <TabFiscalite ctx={ctx} />;
  }
}

// ── Tab 1 : Identité ────────────────────────────────────────────────────────

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

function TabIdentite({ ctx, bienId }: { ctx: EditContext; bienId: string }) {
  const { bien } = ctx;
  return (
    <div style={tabContentStyle}>
      <Section title="Identité du bien">
        <Grid>
          <Field label="Nom de l'immeuble" name="building_name" value={bien.building_name} ctx={ctx} />
          <Field label="N° appartement" name="unit_number" value={bien.unit_number} ctx={ctx} />
          <Field
            label="Référence interne (régie)"
            name="reference_number"
            value={bien.reference_number}
            ctx={ctx}
          />
          <SelectField
            label="Type de bien"
            name="type"
            value={bien.type}
            options={TYPE_OPTIONS}
            ctx={ctx}
          />
        </Grid>
      </Section>

      <Section title="Identifiants officiels">
        <Grid>
          <Field
            label="Identifiant du bâtiment"
            name="egid"
            value={bien.egid}
            type="number"
            ctx={ctx}
            tooltip="EGID — numéro officiel du bâtiment au Registre fédéral des bâtiments et logements (RegBL). Attribué par l'Office fédéral de la statistique."
          />
          <Field
            label="Identifiant du logement"
            name="ewid"
            value={bien.ewid}
            type="number"
            ctx={ctx}
            tooltip="EWID — numéro officiel du logement au Registre fédéral des bâtiments et logements (RegBL). Identifie un logement précis dans un bâtiment."
          />
          <Field
            label="N° de parcelle (cadastre)"
            name="numero_parcelle"
            value={bien.numero_parcelle}
            ctx={ctx}
            tooltip="Identifiant de la parcelle au cadastre cantonal. Visible sur les actes notariés et sur le portail cantonal du registre foncier."
          />
          <Field
            label="N° de lot copropriété"
            name="numero_lot_ppe"
            value={bien.numero_lot_ppe}
            ctx={ctx}
            tooltip="PPE — Propriété Par Étages. Le lot identifie votre appartement à l'intérieur de la copropriété (visible sur l'acte de PPE)."
          />
          <Field
            label="N° de commune (officiel)"
            name="commune_ofs"
            value={bien.commune_ofs}
            type="number"
            ctx={ctx}
            tooltip="Numéro OFS — chaque commune suisse a un numéro unique attribué par l'Office fédéral de la statistique."
          />
        </Grid>
      </Section>

      <Section title="Sécurité opérationnelle">
        <KeysSection bienId={bienId} />
        <div style={{ marginTop: 18 }}>
          <Grid>
            <Field
              label="Code digicode immeuble"
              name="code_digicode"
              value={bien.code_digicode}
              type="password"
              ctx={ctx}
              tooltip="Code d'accès à l'immeuble (interphone, digicode portail). Stocké de manière sécurisée et chiffrée — visible uniquement par les personnes autorisées sur le bien."
            />
          </Grid>
        </div>
      </Section>
    </div>
  );
}

// ── Tab 2 : Localisation ────────────────────────────────────────────────────

const ORIENTATION_OPTIONS = [
  { value: "", label: "—" },
  { value: "N", label: "Nord" },
  { value: "S", label: "Sud" },
  { value: "E", label: "Est" },
  { value: "O", label: "Ouest" },
  { value: "NE", label: "Nord-Est" },
  { value: "NO", label: "Nord-Ouest" },
  { value: "SE", label: "Sud-Est" },
  { value: "SO", label: "Sud-Ouest" },
];

const VUE_OPTIONS = [
  { value: "", label: "—" },
  { value: "lac", label: "Lac" },
  { value: "montagne", label: "Montagne" },
  { value: "campagne", label: "Campagne" },
  { value: "ville", label: "Ville" },
  { value: "cour", label: "Cour" },
  { value: "rue", label: "Rue" },
  { value: "aucune", label: "Aucune particulière" },
];

const BRUIT_OPTIONS = [
  { value: "", label: "—" },
  { value: "calme", label: "Calme" },
  { value: "passable", label: "Passable" },
  { value: "bruyant", label: "Bruyant" },
];

function TabLocalisation({ ctx }: { ctx: EditContext }) {
  const { bien } = ctx;
  return (
    <div style={tabContentStyle}>
      <Section title="Adresse">
        <Grid>
          <Field label="Rue + n°" name="adresse" value={bien.adresse} ctx={ctx} />
          <Field label="NPA" name="cp" value={bien.cp} ctx={ctx} />
          <Field label="Ville" name="ville" value={bien.ville} ctx={ctx} />
          <Field label="Canton" name="canton" value={bien.canton} ctx={ctx} />
        </Grid>
      </Section>

      <Section title="Coordonnées géographiques">
        <Grid>
          <Field label="Latitude" name="lat" value={bien.lat} type="number" ctx={ctx} />
          <Field label="Longitude" name="lng" value={bien.lng} type="number" ctx={ctx} />
        </Grid>
      </Section>

      <Section title="Position dans l'immeuble">
        <Grid>
          <Field label="Étage du logement" name="etage" value={bien.etage} type="number" ctx={ctx} />
          <Field
            label="Nombre d'étages immeuble"
            name="nb_etages"
            value={bien.nb_etages}
            type="number"
            ctx={ctx}
          />
        </Grid>
      </Section>

      <Section title="Environnement">
        <Grid>
          <SelectField
            label="Orientation principale"
            name="orientation_principale"
            value={bien.orientation_principale}
            options={ORIENTATION_OPTIONS}
            ctx={ctx}
          />
          <SelectField label="Vue" name="vue" value={bien.vue} options={VUE_OPTIONS} ctx={ctx} />
          <SelectField
            label="Niveau bruit"
            name="bruit_proximite"
            value={bien.bruit_proximite}
            options={BRUIT_OPTIONS}
            ctx={ctx}
          />
        </Grid>
        <ToggleRow
          label="Accessibilité PMR"
          name="accessibilite_pmr"
          value={bien.accessibilite_pmr}
          ctx={ctx}
        />
        <ToggleRow label="Ascenseur" name="ascenseur" value={bien.ascenseur} ctx={ctx} />
      </Section>
    </div>
  );
}

// ── Tab 3 : Surface & Annexes ───────────────────────────────────────────────

function TabSurface({ ctx, bienId }: { ctx: EditContext; bienId: string }) {
  const { bien } = ctx;
  return (
    <div style={tabContentStyle}>
      <Section title="Surface & pièces">
        <Grid>
          <Field
            label="Surface habitable (m²)"
            name="surface"
            value={bien.surface}
            type="number"
            ctx={ctx}
            tooltip="Surface du logement réellement utilisable. Exclut les caves, balcons, combles non aménagés et terrasses extérieures."
          />
          <Field
            label="Nombre de pièces"
            name="rooms"
            value={bien.rooms}
            type="number"
            step={0.5}
            ctx={ctx}
            tooltip="En Suisse romande, la cuisine compte comme une demi-pièce. Exemple : 3.5 pièces = 3 chambres + cuisine."
          />
          <Field
            label="Chambres"
            name="bedrooms"
            value={bien.bedrooms}
            type="number"
            ctx={ctx}
          />
          <Field
            label="Salles de bain"
            name="bathrooms"
            value={bien.bathrooms}
            type="number"
            ctx={ctx}
          />
        </Grid>
      </Section>

      <Section title="Surfaces annexes (m²)">
        <Grid>
          <Field
            label="Cave"
            name="cave_m2"
            value={bien.cave_m2}
            type="number"
            step={0.01}
            ctx={ctx}
          />
          <Field
            label="Balcon"
            name="balcon_m2"
            value={bien.balcon_m2}
            type="number"
            step={0.01}
            ctx={ctx}
          />
          <Field
            label="Terrasse"
            name="terrasse_m2"
            value={bien.terrasse_m2}
            type="number"
            step={0.01}
            ctx={ctx}
          />
          <Field
            label="Jardin"
            name="jardin_m2"
            value={bien.jardin_m2}
            type="number"
            step={0.01}
            ctx={ctx}
          />
          <Field
            label="Terrain (maisons)"
            name="terrain_m2"
            value={bien.terrain_m2}
            type="number"
            step={0.01}
            ctx={ctx}
          />
        </Grid>
      </Section>

      <AnnexesSection bienId={bienId} />
    </div>
  );
}

// ── Tab 4 : Caractéristiques techniques ─────────────────────────────────────

const DPE_OPTIONS = [
  { value: "", label: "—" },
  ...["A", "B", "C", "D", "E", "F", "G"].map((c) => ({ value: c, label: c })),
];

const CHAUFFAGE_OPTIONS = [
  { value: "", label: "—" },
  { value: "gaz", label: "Gaz" },
  { value: "mazout", label: "Mazout" },
  { value: "pompe_chaleur", label: "Pompe à chaleur" },
  { value: "electrique", label: "Électrique" },
  { value: "bois", label: "Bois" },
  { value: "pellets", label: "Pellets" },
  { value: "district", label: "Chauffage à distance" },
  { value: "autre", label: "Autre" },
];

const EAU_CHAUDE_OPTIONS = [
  { value: "", label: "—" },
  { value: "boiler", label: "Boiler" },
  { value: "chaudiere_commune", label: "Chaudière commune" },
  { value: "panneaux_solaires", label: "Panneaux solaires" },
  { value: "autre", label: "Autre" },
];

const PARKING_OPTIONS = [
  { value: "", label: "Aucun" },
  { value: "exterieur", label: "Extérieur" },
  { value: "exterieur_couvert", label: "Extérieur couvert" },
  { value: "interieur", label: "Intérieur" },
  { value: "interieur_box", label: "Intérieur (box)" },
];

function TabTechnique({ ctx, bienId }: { ctx: EditContext; bienId: string }) {
  const { bien } = ctx;
  return (
    <div style={tabContentStyle}>
      <Section title="Construction & énergie">
        <Grid>
          <Field
            label="Année construction"
            name="annee_construction"
            value={bien.annee_construction}
            type="number"
            ctx={ctx}
          />
          <Field
            label="Année rénovation"
            name="annee_renovation"
            value={bien.annee_renovation}
            type="number"
            ctx={ctx}
          />
          <SelectField
            label="Étiquette énergie"
            name="classe_energetique"
            value={bien.classe_energetique}
            options={DPE_OPTIONS}
            ctx={ctx}
            tooltip="DPE / CECB — classe d'efficacité énergétique du bâtiment, de A (très efficace) à G (peu efficace). Information de plus en plus demandée pour les annonces de location."
          />
          <SelectField
            label="Type de chauffage"
            name="type_chauffage"
            value={bien.type_chauffage}
            options={CHAUFFAGE_OPTIONS}
            ctx={ctx}
          />
          <SelectField
            label="Mode eau chaude"
            name="mode_eau_chaude"
            value={bien.mode_eau_chaude}
            options={EAU_CHAUDE_OPTIONS}
            ctx={ctx}
          />
        </Grid>
      </Section>

      <Section title="Équipements">
        <ToggleGrid>
          <ToggleRow label="Meublé" name="is_furnished" value={bien.is_furnished} ctx={ctx} />
          <ToggleRow label="Balcon" name="has_balcony" value={bien.has_balcony} ctx={ctx} />
          <ToggleRow label="Terrasse" name="has_terrace" value={bien.has_terrace} ctx={ctx} />
          <ToggleRow label="Jardin" name="has_garden" value={bien.has_garden} ctx={ctx} />
          <ToggleRow label="Cave / Réduit" name="has_storage" value={bien.has_storage} ctx={ctx} />
          <ToggleRow label="Cheminée" name="has_fireplace" value={bien.has_fireplace} ctx={ctx} />
          <ToggleRow
            label="Buanderie privée"
            name="has_laundry_private"
            value={bien.has_laundry_private}
            ctx={ctx}
          />
          <ToggleRow
            label="Buanderie commune"
            name="has_laundry_building"
            value={bien.has_laundry_building}
            ctx={ctx}
          />
        </ToggleGrid>
        <SelectField
          label="Parking"
          name="parking_type"
          value={bien.parking_type}
          options={PARKING_OPTIONS}
          ctx={ctx}
        />
      </Section>

      <Section title="Règles de location">
        <ToggleGrid>
          <ToggleRow label="Animaux acceptés" name="pets_allowed" value={bien.pets_allowed} ctx={ctx} />
          <ToggleRow
            label="Fumeurs acceptés"
            name="smoking_allowed"
            value={bien.smoking_allowed}
            ctx={ctx}
          />
        </ToggleGrid>
      </Section>

      <Section title="Distances utiles (minutes)">
        <Grid>
          <Field
            label="Gare"
            name="distance_gare_minutes"
            value={bien.distance_gare_minutes}
            type="number"
            ctx={ctx}
          />
          <Field
            label="Arrêt bus"
            name="distance_arret_bus_minutes"
            value={bien.distance_arret_bus_minutes}
            type="number"
            ctx={ctx}
          />
          <Field
            label="Télécabine"
            name="distance_telecabine_minutes"
            value={bien.distance_telecabine_minutes}
            type="number"
            ctx={ctx}
          />
          <Field
            label="Lac"
            name="distance_lac_minutes"
            value={bien.distance_lac_minutes}
            type="number"
            ctx={ctx}
          />
          <Field
            label="Aéroport"
            name="distance_aeroport_minutes"
            value={bien.distance_aeroport_minutes}
            type="number"
            ctx={ctx}
          />
        </Grid>
        <TextareaField
          label="Notes situation"
          name="situation_notes"
          value={bien.situation_notes}
          ctx={ctx}
        />
      </Section>

      <CompteursSection bienId={bienId} />
    </div>
  );
}

// ── Tab 5 : Conditions location ─────────────────────────────────────────────

const RESIDENCE_OPTIONS = [
  { value: "", label: "—" },
  { value: "principale", label: "Résidence principale" },
  { value: "secondaire", label: "Résidence secondaire" },
  { value: "mixte", label: "Mixte" },
];

const LOCATION_OPTIONS = [
  { value: "", label: "—" },
  { value: "annuelle", label: "Annuelle" },
  { value: "saisonniere", label: "Saisonnière" },
  { value: "semaine", label: "À la semaine" },
  { value: "vide", label: "Vacant" },
];

const CAUTION_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "especes", label: "Espèces / virement direct" },
  { value: "compte_bloque", label: "Compte bancaire bloqué (CO 257e)" },
  { value: "swisscaution", label: "SwissCaution / GoCaution / Firstcaution" },
  { value: "autre", label: "Autre" },
];

function TabLocation({ ctx }: { ctx: EditContext }) {
  const { bien } = ctx;
  return (
    <div style={tabContentStyle}>
      <Section title="Loyer & charges (référence — source légale = Contract)">
        <Grid>
          <Field
            label="Loyer charges incluses (CHF)"
            name="loyer"
            value={bien.loyer}
            type="number"
            step={0.01}
            ctx={ctx}
          />
          <Field
            label="Loyer charges exclues (CHF)"
            name="loyer_charges_exclus"
            value={bien.loyer_charges_exclus}
            type="number"
            step={0.01}
            ctx={ctx}
          />
          <Field
            label="Charges mensuelles (CHF)"
            name="charges"
            value={bien.charges}
            type="number"
            step={0.01}
            ctx={ctx}
          />
          <Field
            label="Provision charges mensuelle (CHF)"
            name="acompte_charges"
            value={bien.acompte_charges}
            type="number"
            step={0.01}
            ctx={ctx}
            tooltip="Montant que le locataire verse chaque mois pour les charges, régularisé en fin d'année selon les frais réels (chauffage, conciergerie, ascenseur, etc.)."
          />
        </Grid>
      </Section>

      <Section title="Garantie de loyer">
        <Grid>
          <Field
            label="Garantie de loyer (CHF)"
            name="deposit"
            value={bien.deposit}
            type="number"
            step={0.01}
            ctx={ctx}
            tooltip="Montant de la garantie de loyer déposée par le locataire. En Suisse, plafonné à 3 mois de loyer net (CO art. 257e)."
          />
          <SelectField
            label="Type de garantie"
            name="caution_type"
            value={bien.caution_type}
            options={CAUTION_TYPE_OPTIONS}
            ctx={ctx}
            tooltip="Espèces (bloquées sur compte bancaire au nom du locataire, CO art. 257e), garantie bancaire (assurance type SwissCaution / GoCaution / Firstcaution), ou cautionnement (garant)."
          />
        </Grid>
      </Section>

      <Section title="Conditions du bail">
        <Grid>
          <Field
            label="Disponible à partir du"
            name="disponibilite_date"
            value={bien.disponibilite_date}
            type="date"
            ctx={ctx}
            tooltip="Date à partir de laquelle le bien est louable (libre, fin du bail précédent, fin des travaux, etc.)."
          />
          <Field
            label="Durée minimale du bail (mois)"
            name="duree_minimale_mois"
            value={bien.duree_minimale_mois}
            type="number"
            ctx={ctx}
            tooltip="Durée minimum d'engagement du locataire. Souvent 12 mois en Suisse romande."
          />
          <Field
            label="Préavis de résiliation (mois)"
            name="preavis_mois"
            value={bien.preavis_mois}
            type="number"
            ctx={ctx}
            tooltip="Délai que le locataire doit respecter pour résilier son bail. Souvent 3 mois en Suisse, à donner par lettre signée pour la fin d'un terme contractuel."
          />
          <SelectField
            label="Type de résidence"
            name="residence_type"
            value={bien.residence_type}
            options={RESIDENCE_OPTIONS}
            ctx={ctx}
          />
          <SelectField
            label="Type de location actuel"
            name="location_type_actuel"
            value={bien.location_type_actuel}
            options={LOCATION_OPTIONS}
            ctx={ctx}
          />
        </Grid>
      </Section>

      <Section title="Charges incluses dans le forfait">
        <p style={chargesHelpStyle}>
          Cochez les postes de charges compris dans le forfait mensuel facturé
          au locataire. Cette liste correspond aux clauses contractuelles du
          bail — distincte du décompte annuel des charges réelles.
        </p>

        <ChargesGroup title="Chauffage et eau chaude">
          <ToggleRow
            label="Chauffage"
            name="charges_chauffage"
            value={bien.charges_chauffage}
            ctx={ctx}
            tooltip="Combustible : mazout, gaz, bois, pellets ou chauffage à distance. Inclut aussi l'énergie nécessaire aux pompes, brûleurs et ventilateurs."
          />
          <ToggleRow
            label="Eau chaude sanitaire"
            name="charges_eau_chaude"
            value={bien.charges_eau_chaude}
            ctx={ctx}
            tooltip="Production d'eau chaude pour la cuisine et la salle de bain (boiler, chaudière commune, panneaux solaires)."
          />
          <ToggleRow
            label="Entretien chaudière"
            name="charges_entretien_chaudiere"
            value={bien.charges_entretien_chaudiere}
            ctx={ctx}
            tooltip="Ramonage, contrôle du brûleur, analyses obligatoires, remplacement filtres et pièces d'usure."
          />
          <ToggleRow
            label="Relevés des compteurs"
            name="charges_releves_compteurs"
            value={bien.charges_releves_compteurs}
            ctx={ctx}
            tooltip="Têtes thermostatiques, compteurs individuels de chaleur ou d'eau chaude, télérelève."
          />
        </ChargesGroup>

        <ChargesGroup title="Conciergerie et entretien">
          <ToggleRow
            label="Conciergerie"
            name="charges_conciergerie"
            value={bien.charges_conciergerie}
            ctx={ctx}
            tooltip="Salaire du concierge (ou société de conciergerie) y compris charges sociales et assurances obligatoires."
          />
          <ToggleRow
            label="Nettoyage des communs"
            name="charges_nettoyage_communs"
            value={bien.charges_nettoyage_communs}
            ctx={ctx}
            tooltip="Nettoyage des escaliers, du hall d'entrée, des vitres communes, ascenseur intérieur."
          />
          <ToggleRow
            label="Produits d'entretien"
            name="charges_produits_entretien"
            value={bien.charges_produits_entretien}
            ctx={ctx}
            tooltip="Produits ménagers (savons, désinfectants, sacs), petit matériel, ampoules des communs."
          />
        </ChargesGroup>

        <ChargesGroup title="Immeuble et espaces communs">
          <ToggleRow
            label="Ascenseur"
            name="charges_ascenseur"
            value={bien.charges_ascenseur}
            ctx={ctx}
            tooltip="Électricité de l'ascenseur + contrat d'entretien et de contrôles techniques périodiques."
          />
          <ToggleRow
            label="Éclairage des communs"
            name="charges_eclairage_communs"
            value={bien.charges_eclairage_communs}
            ctx={ctx}
            tooltip="Couloirs, escaliers, caves, parking commun, abords immédiats de l'immeuble."
          />
          <ToggleRow
            label="Espaces verts"
            name="charges_espaces_verts"
            value={bien.charges_espaces_verts}
            ctx={ctx}
            tooltip="Entretien du jardin, taille des haies, tonte de la pelouse, plantations saisonnières."
          />
          <ToggleRow
            label="Déneigement"
            name="charges_deneigement"
            value={bien.charges_deneigement}
            ctx={ctx}
            tooltip="Déneigement des accès, salage en hiver, location éventuelle d'engin ou contrat saisonnier."
          />
        </ChargesGroup>

        <ChargesGroup title="Taxes publiques et exploitation">
          <ToggleRow
            label="Taxe d'égouts (assainissement)"
            name="charges_taxe_egouts"
            value={bien.charges_taxe_egouts}
            ctx={ctx}
            tooltip="Taxe communale d'assainissement des eaux usées et eaux claires. Souvent calculée sur la consommation d'eau ou la surface du bien."
          />
          <ToggleRow
            label="Ordures ménagères"
            name="charges_ordures"
            value={bien.charges_ordures}
            ctx={ctx}
            tooltip="Taxe communale de base sur les ordures + collecte / vidange (sacs taxés en sus selon la commune)."
          />
          <ToggleRow
            label="Redevance TV / internet"
            name="charges_redevance_tv"
            value={bien.charges_redevance_tv}
            ctx={ctx}
            tooltip="Câble, fibre commune ou redevance Serafe — uniquement si l'abonnement est inclus dans le bail (rare en location pure)."
          />
        </ChargesGroup>
      </Section>
    </div>
  );
}

// ── Helpers Charges incluses ────────────────────────────────────────────────

function ChargesGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={chargesGroupStyle}>
      <p style={chargesGroupTitleStyle}>{title}</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 6,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Tab 7 : Fiscalité & Description ─────────────────────────────────────────

function TabFiscalite({ ctx }: { ctx: EditContext }) {
  const { bien } = ctx;
  return (
    <div style={tabContentStyle}>
      <Section title="Fiscalité">
        <Grid>
          <Field
            label="Valeur locative (impôts)"
            name="valeur_locative_fiscale"
            value={bien.valeur_locative_fiscale}
            type="number"
            step={0.01}
            ctx={ctx}
            tooltip="Valeur locative imposable utilisée pour le calcul de l'impôt sur le revenu si vous occupez le bien. Communiquée par l'administration fiscale cantonale."
          />
          <Field
            label="Valeur assurance bâtiment (ECAB)"
            name="valeur_assurance_ecab"
            value={bien.valeur_assurance_ecab}
            type="number"
            step={0.01}
            ctx={ctx}
            tooltip="ECAB — Établissement Cantonal d'Assurance des Bâtiments. Valeur officielle d'assurance du bâtiment, indispensable en cas de sinistre."
          />
          {/* prix_acquisition, date_acquisition, taux_hypothecaire,
              hypotheque_montant reportés sprint compléments (champs
              absents du modèle DB en 6.a). */}
        </Grid>
      </Section>

      <Section title="Description publique">
        <TextareaField
          label="Description publique (annonce)"
          name="description_publique"
          value={bien.description_publique}
          rows={4}
          ctx={ctx}
        />
        <TextareaField
          label="Points forts"
          name="points_forts"
          value={bien.points_forts}
          rows={3}
          ctx={ctx}
        />
      </Section>

      <Section title="Descriptions internes">
        <TextareaField
          label="Description du lieu"
          name="description_lieu"
          value={bien.description_lieu}
          rows={3}
          ctx={ctx}
        />
        <TextareaField
          label="Description du logement"
          name="description_logement"
          value={bien.description_logement}
          rows={3}
          ctx={ctx}
        />
        <TextareaField
          label="Remarques internes"
          name="remarques"
          value={bien.remarques}
          rows={2}
          ctx={ctx}
        />
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants génériques d'édition inline
// ─────────────────────────────────────────────────────────────────────────────

interface FieldCommonProps {
  label: string;
  name: string;
  ctx: EditContext;
  /** Tooltip explicatif (pattern grand-père friendly — PR-A11.A.6.d). */
  tooltip?: string;
}

function Field({
  label,
  name,
  value,
  ctx,
  type = "text",
  step,
  tooltip,
}: FieldCommonProps & {
  value: string | number | null | undefined;
  type?: "text" | "number" | "date" | "password";
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const [showPwd, setShowPwd] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resync draft quand la valeur cache change.
  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  const isPending = ctx.pendingFields.has(name);
  const justSaved = ctx.justSavedFields.has(name);
  const errorMsg = ctx.errorFields.get(name);

  const startEdit = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === (value == null ? "" : String(value))) return; // no change
    let nextValue: string | number | null = trimmed === "" ? null : trimmed;
    if (type === "number" && nextValue !== null) {
      const n = Number(nextValue);
      if (Number.isNaN(n)) return;
      nextValue = n;
    }
    ctx.save(name, nextValue);
  };

  const cancel = () => {
    setDraft(value == null ? "" : String(value));
    setEditing(false);
  };

  const inputType =
    type === "password" ? (showPwd ? "text" : "password") : type;

  return (
    <div>
      <div style={fieldLabelWrapStyle}>
        <FieldLabel label={label} tooltip={tooltip} />
      </div>
      {editing ? (
        <div className="bien-field--editing" style={fieldEditingWrapStyle}>
          <input
            ref={inputRef}
            type={inputType}
            step={step}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") cancel();
            }}
            style={inlineInputStyle}
          />
          {type === "password" && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowPwd((s) => !s)}
              aria-label={showPwd ? "Masquer" : "Afficher"}
              style={iconBtnInlineStyle}
            >
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          style={fieldReadButtonStyle}
          aria-label={`Modifier ${label}`}
        >
          <span style={fieldReadValueStyle}>
            {type === "password" && value
              ? "••••••"
              : type === "date" && value
              ? new Date(value as string).toLocaleDateString("fr-CH")
              : value === null || value === undefined || value === ""
              ? <em style={{ color: C.text3 }}>Cliquer pour saisir</em>
              : String(value)}
          </span>
          <SaveIndicator pending={isPending} justSaved={justSaved} />
        </button>
      )}
      {errorMsg && <p style={errorMsgStyle}>{errorMsg}</p>}
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
  ctx,
  tooltip,
}: FieldCommonProps & {
  value: string | null | undefined;
  options: { value: string; label: string }[];
}) {
  const isPending = ctx.pendingFields.has(name);
  const justSaved = ctx.justSavedFields.has(name);
  const errorMsg = ctx.errorFields.get(name);
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  const currentLabel = useMemo(
    () => options.find((o) => o.value === (value ?? ""))?.label ?? "—",
    [options, value],
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVal = e.target.value;
    setEditing(false);
    if (newVal === (value ?? "")) return;
    ctx.save(name, newVal === "" ? null : newVal);
  };

  return (
    <div>
      <div style={fieldLabelWrapStyle}>
        <FieldLabel label={label} tooltip={tooltip} />
      </div>
      {editing ? (
        <div className="bien-field--editing" style={fieldEditingWrapStyle}>
          <select
            ref={selectRef}
            autoFocus
            value={value ?? ""}
            onChange={handleChange}
            onBlur={() => setEditing(false)}
            style={inlineInputStyle}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={fieldReadButtonStyle}
          aria-label={`Modifier ${label}`}
        >
          <span style={fieldReadValueStyle}>{currentLabel}</span>
          <SaveIndicator pending={isPending} justSaved={justSaved} />
        </button>
      )}
      {errorMsg && <p style={errorMsgStyle}>{errorMsg}</p>}
    </div>
  );
}

function TextareaField({
  label,
  name,
  value,
  ctx,
  rows = 3,
  tooltip,
}: FieldCommonProps & { value: string | null | undefined; rows?: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value ?? "");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setDraft(value ?? ""), [value]);

  const isPending = ctx.pendingFields.has(name);
  const justSaved = ctx.justSavedFields.has(name);
  const errorMsg = ctx.errorFields.get(name);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === (value ?? "")) return;
    ctx.save(name, trimmed === "" ? null : trimmed);
  };

  return (
    <div>
      <div style={fieldLabelWrapStyle}>
        <FieldLabel label={label} tooltip={tooltip} />
      </div>
      {editing ? (
        <div className="bien-field--editing" style={{ padding: 4 }}>
          <textarea
            ref={taRef}
            autoFocus
            rows={rows}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(value ?? "");
                setEditing(false);
              }
            }}
            style={{ ...inlineInputStyle, resize: "vertical" }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setTimeout(() => taRef.current?.focus(), 0);
          }}
          style={{ ...fieldReadButtonStyle, alignItems: "flex-start" }}
          aria-label={`Modifier ${label}`}
        >
          <span
            style={{
              ...fieldReadValueStyle,
              whiteSpace: "pre-wrap",
              textAlign: "left",
            }}
          >
            {value && value.trim() !== "" ? (
              value
            ) : (
              <em style={{ color: C.text3 }}>Cliquer pour saisir</em>
            )}
          </span>
          <SaveIndicator pending={isPending} justSaved={justSaved} />
        </button>
      )}
      {errorMsg && <p style={errorMsgStyle}>{errorMsg}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  name,
  value,
  ctx,
  tooltip,
}: FieldCommonProps & { value: boolean | null | undefined }) {
  const isPending = ctx.pendingFields.has(name);
  const justSaved = ctx.justSavedFields.has(name);
  const errorMsg = ctx.errorFields.get(name);

  const toggle = () => ctx.save(name, !Boolean(value));

  return (
    <div>
      <label style={toggleLabelStyle}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14, color: C.text2 }}>{label}</span>
          {tooltip && <FieldLabel label="" tooltip={tooltip} />}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SaveIndicator pending={isPending} justSaved={justSaved} />
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(value)}
            onClick={toggle}
            style={{
              width: 40,
              height: 22,
              borderRadius: 11,
              border: "none",
              background: value ? C.prussian : C.border,
              position: "relative",
              cursor: "pointer",
              transition: "background 200ms ease",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: value ? 20 : 2,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 200ms ease",
              }}
            />
          </button>
        </span>
      </label>
      {errorMsg && <p style={errorMsgStyle}>{errorMsg}</p>}
    </div>
  );
}

function SaveIndicator({
  pending,
  justSaved,
}: {
  pending: boolean;
  justSaved: boolean;
}) {
  if (pending) {
    return <Loader2 size={14} className="animate-spin" style={{ color: C.text3 }} />;
  }
  if (justSaved) {
    return <Check size={14} style={{ color: C.green }} />;
  }
  return null;
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={sectionTitleStyle}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}

function ToggleGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  zIndex: 100,
};

const shellStyle: React.CSSProperties = {
  background: "#fff",
  width: "100%",
  maxWidth: "100%",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "18px 28px",
  borderBottom: "1px solid var(--border-subtle)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  background: "#fff",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 22,
  color: C.prussian,
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text3,
  margin: "2px 0 0",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: C.text3,
  padding: 4,
  lineHeight: 0,
  flexShrink: 0,
};

const tabsNavStyle: React.CSSProperties = {
  flexShrink: 0,
  display: "flex",
  overflowX: "auto",
  borderBottom: "1px solid var(--border-subtle)",
  padding: "0 28px",
  background: "#fff",
};

const tabBtnStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "12px 16px",
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "24px 28px",
  background: "#fff",
};

const tabContentStyle: React.CSSProperties = {
  maxWidth: 880,
  margin: "0 auto",
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 18,
  color: C.text,
  margin: "0 0 12px",
  paddingBottom: 8,
  borderBottom: `1px solid ${C.border}`,
  fontWeight: 400,
};

const fieldLabelWrapStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
};

const chargesHelpStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text2,
  margin: "0 0 14px",
  lineHeight: 1.5,
};

const chargesGroupStyle: React.CSSProperties = {
  marginTop: 12,
};

const chargesGroupTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: C.prussian,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  margin: "0 0 8px",
};

const fieldReadButtonStyle: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "transparent",
  border: `1px solid transparent`,
  borderRadius: 6,
  padding: "8px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minHeight: 36,
  transition: "background 150ms ease, border-color 150ms ease",
};

const fieldReadValueStyle: React.CSSProperties = {
  fontSize: 14,
  color: C.text,
  flex: 1,
};

const fieldEditingWrapStyle: React.CSSProperties = {
  padding: 4,
  display: "flex",
  alignItems: "center",
  gap: 4,
};

const inlineInputStyle: React.CSSProperties = {
  flex: 1,
  width: "100%",
  background: "#fff",
  border: `1px solid ${C.prussian}`,
  borderRadius: 6,
  padding: "7px 10px",
  fontSize: 14,
  color: C.text,
  fontFamily: "inherit",
  outline: "none",
};

const iconBtnInlineStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: C.text3,
  padding: 4,
  display: "inline-flex",
  alignItems: "center",
};

const toggleLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 14,
  color: C.text2,
  padding: "6px 10px",
};

const errorMsgStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.red,
  margin: "4px 10px 0",
};

const loadingStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text3,
  textAlign: "center",
  padding: 32,
  margin: 0,
};
