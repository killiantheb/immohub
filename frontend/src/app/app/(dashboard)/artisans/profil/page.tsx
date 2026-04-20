"use client";

/**
 * /app/artisans/profil — Profil artisan + souscription + Stripe Connect.
 *
 * Flow inscription M1 :
 *  1. Infos de base (via /auth/register + /profiles-artisans)
 *  2. Canton + spécialités → POST /profiles-artisans/subscribe
 *     → si places fondateurs dispo dans le canton : plan gratuit à vie
 *     → sinon : plan artisan_verified CHF 49/mois (paiement requis)
 *  3. Stripe Connect Express onboarding (KYC + IBAN)
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Gift, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { C } from "@/lib/design-tokens";
import { Analytics } from "@/lib/analytics";

const CANTONS = [
  "GE","VD","VS","NE","FR","JU","BE","ZH","BS","BL","AG","AR","AI",
  "GL","GR","LU","NW","OW","SG","SH","SO","SZ","TG","TI","UR","ZG",
];

const SPECIALTIES = [
  "plomberie","electricite","peinture","serrurerie","toiture",
  "jardinage","maconnerie","cvc","renovation","nettoyage",
];

type Profil = {
  id: string;
  user_id: string;
  raison_sociale: string | null;
  canton: string | null;
  specialties: string[] | null;
  subscription_plan: string | null;
  is_founding_member: boolean;
  stripe_connect_id: string | null;
  stripe_connect_ready: boolean;
  subscription_activated_at: string | null;
};

type FoundingSpot = { canton: string; total_spots: number; taken: number; remaining: number };

export default function ProfilArtisanPage() {
  const qc = useQueryClient();
  const [canton, setCanton] = useState<string>("");
  const [specs, setSpecs] = useState<string[]>([]);

  const profilQ = useQuery({
    queryKey: ["artisan-profil"],
    queryFn: async (): Promise<Profil> => (await api.get("/profiles-artisans/me")).data,
  });

  const spotsQ = useQuery({
    queryKey: ["founding-spots"],
    queryFn: async (): Promise<FoundingSpot[]> =>
      (await api.get("/profiles-artisans/founding-spots")).data,
    staleTime: 60_000,
  });

  useEffect(() => {
    const p = profilQ.data;
    if (p) {
      setCanton(p.canton ?? "");
      setSpecs(p.specialties ?? []);
    }
  }, [profilQ.data]);

  const subscribeMut = useMutation({
    mutationFn: async () =>
      (await api.post("/profiles-artisans/subscribe", {
        canton, specialties: specs, desired_plan: "artisan_free_early",
      })).data,
    onSuccess: (data: { assigned_plan: "artisan_free_early" | "artisan_verified"; is_founding_member: boolean }) => {
      Analytics.artisanSignupCompleted(canton, specs);
      Analytics.artisanSubscriptionActivated(data.assigned_plan, canton, data.is_founding_member);
      qc.invalidateQueries({ queryKey: ["artisan-profil"] });
      qc.invalidateQueries({ queryKey: ["founding-spots"] });
    },
  });

  const connectMut = useMutation({
    mutationFn: async (): Promise<{ url: string }> =>
      (await api.post("/profiles-artisans/stripe-connect/onboard")).data,
    onSuccess: (data) => { if (data.url) window.location.href = data.url; },
  });

  const refreshMut = useMutation({
    mutationFn: async () => (await api.post("/profiles-artisans/stripe-connect/refresh")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["artisan-profil"] }),
  });

  const spotForCanton = useMemo(
    () => spotsQ.data?.find(s => s.canton === canton),
    [canton, spotsQ.data],
  );

  const profil = profilQ.data;

  if (profilQ.isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <Loader2 size={28} className="animate-spin" />
      </div>
    );
  }

  const hasPlan = Boolean(profil?.subscription_plan);
  const needsKyc = hasPlan && !profil?.stripe_connect_ready;

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: "32px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 300, color: C.text, margin: 0 }}>
          Mon profil artisan
        </h1>
        <p style={{ color: C.textMuted, margin: "8px 0 0" }}>
          Inscrivez-vous au marketplace Althy — 5% commission sur chaque intervention.
        </p>
      </div>

      {/* Carte plan actuel */}
      {hasPlan && (
        <div style={{
          background: profil?.is_founding_member ? C.prussianBg : C.surface,
          border: `1px solid ${profil?.is_founding_member ? C.prussianBorder : C.border}`,
          borderRadius: 12, padding: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {profil?.is_founding_member ? <Gift size={18} color={C.prussian} /> : <ShieldCheck size={18} color={C.prussian} />}
            <strong style={{ color: C.text }}>
              {profil?.is_founding_member ? "Artisan Fondateur — Gratuit à vie" : "Artisan Vérifié — CHF 49/mois"}
            </strong>
          </div>
          <div style={{ fontSize: 14, color: C.textMuted }}>
            Canton : <strong>{profil?.canton}</strong> · Spécialités : {profil?.specialties?.join(", ") || "—"}
          </div>
        </div>
      )}

      {/* Étape 1 : choix canton + spécialités (si pas encore souscrit) */}
      {!hasPlan && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 18, margin: 0, color: C.text }}>Rejoindre le marketplace</h2>
          <p style={{ fontSize: 14, color: C.textMuted, margin: "8px 0 20px" }}>
            Les 50 premiers artisans de chaque canton rejoignent gratuitement à vie (badge Fondateur).
          </p>

          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
            Canton principal
          </label>
          <select
            value={canton}
            onChange={e => setCanton(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 14 }}
          >
            <option value="">— Sélectionner —</option>
            {CANTONS.map(c => (
              <option key={c} value={c}>
                {c} {spotsQ.data?.find(s => s.canton === c)?.remaining ?? "?"} places fondateurs
              </option>
            ))}
          </select>

          {canton && spotForCanton && (
            <div style={{
              padding: "10px 12px", borderRadius: 8,
              background: spotForCanton.remaining > 0 ? C.prussianBg : C.surface2,
              border: `1px solid ${spotForCanton.remaining > 0 ? C.prussianBorder : C.border}`,
              fontSize: 13, color: C.text, marginBottom: 16,
            }}>
              {spotForCanton.remaining > 0 ? (
                <><Sparkles size={14} style={{ display: "inline", marginRight: 6 }} color={C.prussian} />
                  <strong>{spotForCanton.remaining} places fondateurs restantes</strong> dans {canton} — rejoignez gratuitement à vie.
                </>
              ) : (
                <>Canton complet pour les fondateurs — vous rejoindrez au plan Vérifié (CHF 49/mois).</>
              )}
            </div>
          )}

          <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.text, marginBottom: 6 }}>
            Spécialités
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {SPECIALTIES.map(s => {
              const on = specs.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpecs(on ? specs.filter(x => x !== s) : [...specs, s])}
                  style={{
                    padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 500,
                    border: `1px solid ${on ? C.prussianBorder : C.border}`,
                    background: on ? C.prussianBg : C.surface,
                    color: on ? C.prussian : C.text, cursor: "pointer",
                  }}
                >{s}</button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!canton || specs.length === 0 || subscribeMut.isPending}
            onClick={() => subscribeMut.mutate()}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 10,
              background: C.prussian, color: "#fff", fontWeight: 600,
              border: "none", cursor: "pointer", opacity: (!canton || specs.length === 0) ? 0.5 : 1,
            }}
          >
            {subscribeMut.isPending ? "Inscription…" : "Rejoindre le marketplace"}
          </button>
        </div>
      )}

      {/* Étape 2 : Stripe Connect */}
      {hasPlan && (
        <div style={{
          background: needsKyc ? "#FEF9E7" : C.surface,
          border: `1px solid ${needsKyc ? "#F5E7A5" : C.border}`,
          borderRadius: 12, padding: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            {profil?.stripe_connect_ready
              ? <CheckCircle2 size={18} color={C.green} />
              : <ShieldCheck size={18} color="#B5975A" />}
            <strong style={{ color: C.text }}>
              {profil?.stripe_connect_ready ? "Compte Stripe actif — 95% reversés automatiquement" : "Activer Stripe Connect (KYC + IBAN)"}
            </strong>
          </div>
          <p style={{ fontSize: 13, color: C.textMuted, margin: "0 0 14px" }}>
            Althy retient 5% de chaque facture et vous reverse les 95% restants sur votre IBAN.
          </p>
          {!profil?.stripe_connect_ready && (
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => connectMut.mutate()}
                disabled={connectMut.isPending}
                style={{
                  padding: "10px 16px", borderRadius: 8,
                  background: C.prussian, color: "#fff", fontWeight: 600,
                  border: "none", cursor: "pointer",
                }}
              >{connectMut.isPending ? "Redirection Stripe…" : "Configurer Stripe Connect"}</button>
              <button
                type="button"
                onClick={() => refreshMut.mutate()}
                disabled={refreshMut.isPending}
                style={{
                  padding: "10px 16px", borderRadius: 8,
                  background: "transparent", color: C.prussian, fontWeight: 600,
                  border: `1px solid ${C.prussianBorder}`, cursor: "pointer",
                }}
              >Rafraîchir</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
