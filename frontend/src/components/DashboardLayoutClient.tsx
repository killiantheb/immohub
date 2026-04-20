"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/lib/hooks/useRole";
import { DashboardShell } from "./DashboardShell";
import { isEnabled, isRoleEnabled } from "@/lib/flags";

// Pages immersives — pas de sidebar/header
const IMMERSIVE_PATHS = ["/app/sphere"];

/**
 * Pages Phase 2+ : masquées dans la sidebar mais accessibles par URL directe.
 * Clé = préfixe de chemin, valeur = rôles autorisés.
 * Un utilisateur avec un rôle absent de la liste est redirigé vers /app/sphere.
 */
const RESTRICTED_PAGES: Record<string, string[]> = {
  "/app/hunters":          ["proprio_solo", "agence", "super_admin"],
  "/app/hunter":           ["hunter",       "super_admin"],
  "/app/vente":            ["proprio_solo", "agence", "super_admin"],
  "/app/annonces":         ["proprio_solo", "agence", "super_admin"],
  "/app/ouvreurs":         ["opener",       "super_admin"],
  "/app/ouvreur":          ["opener",       "super_admin"],
  "/app/comptabilite":     ["proprio_solo", "agence", "super_admin"],
  "/app/mes-candidatures": ["locataire",    "acheteur_premium", "super_admin"],
  "/app/candidatures":     ["proprio_solo", "agence", "super_admin"],
  "/app/acheteur":         ["acheteur_premium", "super_admin"],
  "/app/expert":           ["expert",       "super_admin"],
  "/app/assurance":        ["proprio_solo", "locataire", "super_admin"],
  "/app/transactions":     ["proprio_solo", "agence", "super_admin"],
  "/app/portail":          ["agence",       "super_admin"],
};

/**
 * Pages gated par feature flag. Si le flag est off, la page est inaccessible
 * même pour les rôles autorisés dans RESTRICTED_PAGES.
 */
import type { FlagName } from "@/lib/flags";
const FLAG_GATED_PAGES: Record<string, FlagName> = {
  "/app/vente":        "FEATURE_VENTE",
  "/app/assurance":    "FEATURE_INSURANCE",
  "/app/transactions": "FEATURE_TRANSACTIONS",
  "/app/hunters":      "ROLE_HUNTER",
  "/app/hunter":       "ROLE_HUNTER",
  "/app/portail":      "ROLE_PORTAIL_PROPRIO",
};

/** Écran affiché quand le rôle de l'utilisateur n'est pas encore activé (Phase 2+). */
function RoleEnPreparation({ role }: { role: string }) {
  const ROLE_LABELS: Record<string, string> = {
    agence: "Agence",
    portail_proprio: "Portail Proprio",
    artisan: "Artisan",
    opener: "Ouvreur",
    expert: "Expert",
    hunter: "Hunter",
    acheteur_premium: "Acheteur Premium",
  };
  const label = ROLE_LABELS[role] ?? role;

  return (
    <DashboardShell>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "60vh", padding: 32,
      }}>
        <div style={{
          maxWidth: 480, textAlign: "center",
          background: "var(--althy-surface, #fff)",
          border: "1px solid var(--althy-border, #E8E4DC)",
          borderRadius: "var(--radius-card, 12px)",
          padding: "48px 32px",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
          <h1 style={{
            fontFamily: "var(--font-serif)",
            fontSize: 24, fontWeight: 600, marginBottom: 8,
            color: "var(--althy-text, #3D3830)",
          }}>
            Votre espace {label} est en préparation
          </h1>
          <p style={{
            color: "var(--althy-text-2, #5C5650)",
            fontSize: 15, lineHeight: 1.6, marginBottom: 24,
          }}>
            Cette fonctionnalité sera bientôt disponible. Nous vous préviendrons
            dès que votre espace sera prêt.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/app/sphere"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 20px", borderRadius: "var(--radius-elem, 8px)",
                background: "var(--althy-orange)", color: "#fff",
                fontWeight: 600, fontSize: 14, textDecoration: "none",
              }}
            >
              Accéder à Althy IA →
            </Link>
            <Link
              href="/contact"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 20px", borderRadius: "var(--radius-elem, 8px)",
                border: "1px solid var(--althy-border, #E8E4DC)",
                color: "var(--althy-text-2, #5C5650)",
                fontWeight: 500, fontSize: 14, textDecoration: "none",
              }}
            >
              Nous contacter
            </Link>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { role } = useRole();

  // Rôle désactivé par feature flag → afficher l'écran "en préparation"
  const roleDisabled = role !== null && !isRoleEnabled(role);

  // Trouve une restriction correspondant au chemin courant
  const restricted = Object.entries(RESTRICTED_PAGES).find(([path]) =>
    pathname.startsWith(path)
  );
  // Interdit uniquement quand le rôle est connu (non-null) et absent de la liste
  const roleForbidden = role !== null && !!restricted && !restricted[1].includes(role);

  // Vérifie si la page est derrière un feature flag désactivé
  const flagGated = Object.entries(FLAG_GATED_PAGES).find(([path]) =>
    pathname.startsWith(path)
  );
  const flagForbidden = !!flagGated && !isEnabled(flagGated[1]);

  const forbidden = roleForbidden || flagForbidden;

  useEffect(() => {
    if (forbidden) router.replace("/app/sphere");
  }, [forbidden, router]);

  // Rôle feature-flagged off → écran dédié (pas de redirection, on reste dans le shell)
  if (roleDisabled && role) {
    return <RoleEnPreparation role={role} />;
  }

  if (IMMERSIVE_PATHS.includes(pathname)) {
    return <div style={{ minHeight: "100vh" }}>{children}</div>;
  }

  // Écran blanc pendant la redirection — évite le flash du contenu interdit
  if (forbidden) return null;

  return <DashboardShell>{children}</DashboardShell>;
}
