"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, FileX2, AlertCircle } from "lucide-react";
import { useResiliations } from "@/lib/hooks/useSprint10";
import { C } from "@/lib/design-tokens";

const INITIATEUR_LABELS: Record<string, string> = {
  locataire: "Locataire",
  bailleur: "Bailleur",
  agence_mandataire: "Agence",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#6E7682",
  pending_signatures: "#C9A961",
  signed: "#0F2E4C",
  envoyee: "#0F2E4C",
  appliquee: "#0F2E4C",
  annulee: "#6E7682",
};

export default function ResiliationsListPage() {
  const sp = useSearchParams();
  const contractId = sp.get("contract_id") ?? undefined;
  const { data, isLoading, isError } = useResiliations({ contract_id: contractId });

  return (
    <div style={{ padding: "24px 0" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 400, color: C.text, margin: 0 }}>
          Résiliations
        </h1>
        <Link
          href={contractId ? `/app/resiliations/new?contract_id=${contractId}` : "/app/resiliations/new"}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: C.prussian, color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
        >
          <Plus className="h-4 w-4" />
          Nouvelle résiliation
        </Link>
      </header>

      {isLoading && <p style={{ color: C.text3 }}>Chargement…</p>}
      {isError && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#991B1B" }}><AlertCircle className="h-4 w-4" /> Erreur de chargement.</div>}

      {data && data.items.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 16px", color: C.text3 }}>
          <FileX2 className="h-10 w-10" style={{ margin: "0 auto", color: C.gold }} />
          <p style={{ marginTop: 12 }}>Aucune résiliation enregistrée.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {data.items.map((r) => (
            <Link
              key={r.id}
              href={`/app/resiliations/${r.id}`}
              style={{ display: "block", padding: "16px 20px", background: "#fff", borderRadius: 10, border: `1px solid ${C.border}`, textDecoration: "none", color: C.text }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: C.text3, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>{r.reference}</p>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: "4px 0 0" }}>
                    Initiée par {INITIATEUR_LABELS[r.initiateur]} · effective {r.date_resiliation}
                  </h3>
                  <p style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>
                    Préavis {r.respect_preavis ? "respecté" : "extraordinaire"} ({r.preavis_months} mois)
                    {r.motif ? ` · ${r.motif.slice(0, 80)}` : ""}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: STATUS_COLORS[r.status] ?? "#6E7682", color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {r.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
