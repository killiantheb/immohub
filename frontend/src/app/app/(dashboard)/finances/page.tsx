"use client";

import { ComptabiliteView } from "@/components/finances/ComptabiliteView";
import { C } from "@/lib/design-tokens";

export default function FinancesPage() {
  return (
    <div>
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
