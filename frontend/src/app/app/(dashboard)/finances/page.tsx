"use client";

import { Suspense } from "react";
import { ComptabiliteView } from "@/components/finances/ComptabiliteView";
import { BienContextBanner } from "@/components/biens/BienContextBanner";
import { C } from "@/lib/design-tokens";

export default function FinancesPage() {
  return (
    <div>
      {/* Banner contextuel — affiché uniquement si ?bien_id=X dans l'URL.
          Le filtrage côté ComptabiliteView est Phase 2 (backend doit accepter
          le filtre nativement). En attendant, l'utilisateur voit la liste
          complète mais sait via le banner qu'il a cliqué depuis la fiche bien. */}
      <Suspense fallback={null}>
        <BienContextBanner />
      </Suspense>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 300, color: C.text, margin: "0 0 4px" }}>
          Finances
        </h1>
        <p style={{ fontSize: 13, color: C.text3, margin: 0 }}>
          Comptabilité, exports fiduciaires et déclarations fiscales
        </p>
      </div>
      <ComptabiliteView />
    </div>
  );
}
