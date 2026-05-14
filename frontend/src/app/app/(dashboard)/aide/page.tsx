// Sprint 9 Lot C — Page "Aide" stub (ComingSoon Phase 1.1).
//
// Le dropdown UserMenu (top-right) expose une entrée "Aide" qui pointe ici.
// La vraie centre d'aide (FAQ, contact support, tutos) arrivera Phase 1.1.
import { ComingSoon } from "@/components/ComingSoon";

export default function AidePage() {
  return (
    <ComingSoon
      title="Centre d'aide"
      phase="Phase 1.1"
      description="Le centre d'aide Althy (FAQ, tutoriels, contact support) sera disponible en Phase 1.1. En attendant, contactez-nous directement par email."
    />
  );
}
