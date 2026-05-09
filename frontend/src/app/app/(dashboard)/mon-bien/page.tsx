"use client";

// Phase 1.0 doctrine v6 (Sprint 1A — 2026-05-09) : page placeholder.
// La vraie page espace locataire (vue lecture seule SON bien : adresse, bail,
// paiements, documents, messagerie 1:1 bailleur) sera codée Sprint 1C.
// Cf docs/4-PRODUIT.md §4.7 "Module Espace Locataire".
//
// Sécurité produit : DashboardLayoutClient.tsx restreint cette route à
// ["locataire", "super_admin"]. Un autre rôle qui tape /app/mon-bien sera
// redirigé vers /app/sphere par le layout (pas besoin de double-guard ici).

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/lib/hooks/useRole";
import { C } from "@/lib/design-tokens";

export default function MonBienPage() {
  const router = useRouter();
  const { role } = useRole();

  // Defense in depth : si le layout n'a pas redirigé (ex: race condition role
  // pas encore chargé), bascule manuel vers /app pour que les autres rôles ne
  // restent pas bloqués sur cette page placeholder.
  useEffect(() => {
    if (role && role !== "locataire" && role !== "super_admin") {
      router.replace("/app");
    }
  }, [role, router]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          textAlign: "center",
          background: "var(--althy-surface, #fff)",
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "48px 36px",
          boxShadow: C.shadow,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: C.prussianBg,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
            fontSize: 24,
          }}
        >
          🏠
        </div>
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 26,
            fontWeight: 400,
            color: C.text,
            margin: "0 0 12px",
          }}
        >
          Mon espace
        </h1>
        <p
          style={{
            fontSize: 15,
            color: C.textMuted,
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}
        >
          Votre espace dédié à votre bien arrive bientôt.
          <br />
          Vous y retrouverez votre bail, vos paiements, vos documents et la
          messagerie avec votre bailleur.
        </p>
        <p
          style={{
            fontSize: 12,
            color: C.text3,
            margin: 0,
            letterSpacing: "0.04em",
          }}
        >
          Phase 1.0 — Sprint 1C en préparation
        </p>
      </div>
    </div>
  );
}
