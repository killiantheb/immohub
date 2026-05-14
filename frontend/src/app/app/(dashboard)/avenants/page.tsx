"use client";

/**
 * Liste des avenants au bail — Sprint 10 Lot 6.
 *
 * Filtre par contract_id si query param fourni (ex: ouvert depuis fiche bail).
 * RBAC : proprio_solo, agence (mandataire), super_admin, locataire (sien uniquement).
 */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, FileSignature, AlertCircle } from "lucide-react";
import { useAvenants } from "@/lib/hooks/useSprint10";
import { C } from "@/lib/design-tokens";

const AVENANT_TYPE_LABELS: Record<string, string> = {
  animaux: "Animaux",
  modification_loyer: "Modification loyer",
  modification_date: "Modification date",
  prolongation: "Prolongation",
  resiliation_anticipee: "Résiliation anticipée",
  changement_proprietaire: "Changement propriétaire",
  changement_locataire: "Changement locataire",
  charge_electrique: "Charge électrique",
  accord_specifique: "Accord spécifique",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "#6E7682",
  pending_signatures: "#C9A961",
  partial_signed: "#C9A961",
  signed: "#0F2E4C",
  terminated: "#6E7682",
};

export default function AvenantsListPage() {
  const sp = useSearchParams();
  const contractId = sp.get("contract_id") ?? undefined;
  const { data, isLoading, isError } = useAvenants({ contract_id: contractId });

  return (
    <div style={{ padding: "24px 0" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 400, color: C.text, margin: 0 }}>
            Avenants au bail
          </h1>
          {contractId && (
            <p style={{ fontSize: 13, color: C.text3, marginTop: 4 }}>
              Filtré par bail · <Link href={`/app/contracts/${contractId}`} style={{ color: C.gold }}>Retour au bail</Link>
            </p>
          )}
        </div>
        <Link
          href={contractId ? `/app/avenants/new?contract_id=${contractId}` : "/app/avenants/new"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 18px",
            background: C.prussian,
            color: "#fff",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <Plus className="h-4 w-4" />
          Nouvel avenant
        </Link>
      </header>

      {isLoading && <p style={{ color: C.text3 }}>Chargement…</p>}

      {isError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#991B1B" }}>
          <AlertCircle className="h-4 w-4" /> Impossible de charger les avenants.
        </div>
      )}

      {data && data.items.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 16px", color: C.text3 }}>
          <FileSignature className="h-10 w-10" style={{ margin: "0 auto", color: C.gold }} />
          <p style={{ marginTop: 12 }}>Aucun avenant pour ce bail. Créez-en un pour modifier les conditions.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {data.items.map((a) => (
            <Link
              key={a.id}
              href={`/app/avenants/${a.id}`}
              style={{
                display: "block",
                padding: "16px 20px",
                background: "#fff",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                textDecoration: "none",
                color: C.text,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: C.text3, letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>
                    {a.reference}
                  </p>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: "4px 0 0" }}>
                    {AVENANT_TYPE_LABELS[a.avenant_type] ?? a.avenant_type}
                  </h3>
                  <p style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>{a.objet.slice(0, 120)}</p>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: STATUS_COLORS[a.status] ?? "#6E7682",
                    color: "#fff",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {a.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
