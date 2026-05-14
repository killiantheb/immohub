// Sprint 9 Lot C — Page "Locataires" stub (navigation only).
//
// La vraie vue (agrégat locataires actifs + candidatures passées Phase 1.0)
// sera implémentée par un autre lot du Sprint 9 (refonte contenu). Lot C
// (navigation) câble uniquement l'entrée sidebar + cette page placeholder
// pour éviter un 404 en attendant.
import { ComingSoon } from "@/components/ComingSoon";

export default function LocatairesPage() {
  return (
    <ComingSoon
      title="Vue Locataires unifiée"
      phase="Phase 1.0 (prochain lot Sprint 9)"
      description="Cette vue regroupera vos locataires actifs et l'historique de leurs candidatures en un seul endroit. En attendant, retrouvez ces informations via la fiche de chaque bien."
    />
  );
}
