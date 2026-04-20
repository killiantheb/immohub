"use client";

/**
 * PartnerConsentBox — Checkbox de consentement RGPD pour les partenariats.
 *
 * Usage :
 *   <PartnerConsentBox vertical="insurance" label="Je souhaite être contacté pour une couverture assurance" />
 *
 * Côté backend, cochage = POST /partners/consent avec consent_type=partner_<vertical>
 * (enregistré dans la table `consents`, immuable — preuve RGPD).
 *
 * La case est pré-cochée si un consentement `accepted=true` existe déjà (GET /partners/consent).
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Shield } from "lucide-react";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";

export type PartnerVertical =
  | "insurance"
  | "caution"
  | "mortgage"
  | "moving"
  | "energy"
  | "telecom";

type ConsentMap = Record<PartnerVertical, { accepted: boolean; at: string | null } | undefined>;

export function PartnerConsentBox({
  vertical,
  label,
  hint,
}: {
  vertical: PartnerVertical;
  label: string;
  hint?: string;
}) {
  const qc = useQueryClient();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const consentsQ = useQuery({
    queryKey: ["partner-consents"],
    queryFn: async (): Promise<ConsentMap> => (await api.get("/partners/consent")).data,
    staleTime: 30_000,
  });

  const current = optimistic ?? consentsQ.data?.[vertical]?.accepted ?? false;

  const mut = useMutation({
    mutationFn: async (accepted: boolean) =>
      (await api.post("/partners/consent", { vertical, accepted })).data,
    onMutate: (accepted) => {
      setOptimistic(accepted);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["partner-consents"] });
      setOptimistic(null);
    },
  });

  useEffect(() => {
    if (!consentsQ.isLoading) setOptimistic(null);
  }, [consentsQ.isLoading]);

  return (
    <label
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 14px", borderRadius: 10,
        background: current ? C.prussianBg : C.surface,
        border: `1px solid ${current ? C.prussianBorder : C.border}`,
        cursor: "pointer", transition: "all 120ms",
      }}
    >
      <input
        type="checkbox"
        checked={current}
        disabled={mut.isPending || consentsQ.isLoading}
        onChange={(e) => mut.mutate(e.target.checked)}
        style={{ marginTop: 3, accentColor: "var(--althy-prussian)" }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: C.text, fontWeight: 500 }}>
          {mut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} color={C.prussian} />}
          {label}
        </div>
        {hint && (
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{hint}</div>
        )}
      </div>
    </label>
  );
}

/**
 * PartnerConsentPanel — affiche les 6 cases d'un coup (page profil / paramètres).
 */
export function PartnerConsentPanel() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <PartnerConsentBox
        vertical="insurance"
        label="Recevoir des propositions d'assurance (bâtiment, RC, inventaire)"
        hint="Un partenaire vous contactera avec un devis ; sans engagement."
      />
      <PartnerConsentBox
        vertical="caution"
        label="Recevoir des propositions de caution loyer"
      />
      <PartnerConsentBox
        vertical="mortgage"
        label="Recevoir des propositions d'hypothèque"
      />
      <PartnerConsentBox
        vertical="moving"
        label="Recevoir des propositions de déménageurs"
      />
      <PartnerConsentBox
        vertical="energy"
        label="Recevoir des propositions d'énergie"
      />
      <PartnerConsentBox
        vertical="telecom"
        label="Recevoir des propositions telecom (internet, mobile)"
      />
    </div>
  );
}
