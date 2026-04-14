"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRole } from "@/lib/hooks/useRole";
import { DashboardShell } from "./DashboardShell";

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
  "/app/listings":         ["proprio_solo", "agence", "super_admin"],
  "/app/ouvreurs":         ["opener",       "super_admin"],
  "/app/ouvreur":          ["opener",       "super_admin"],
  "/app/comptabilite":     ["proprio_solo", "agence", "super_admin"],
  "/app/mes-candidatures": ["locataire",    "super_admin"],
  "/app/acheteur":         ["acheteur_premium", "super_admin"],
  "/app/expert":           ["expert",       "super_admin"],
};

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { role } = useRole();

  // Trouve une restriction correspondant au chemin courant
  const restricted = Object.entries(RESTRICTED_PAGES).find(([path]) =>
    pathname.startsWith(path)
  );
  // Interdit uniquement quand le rôle est connu (non-null) et absent de la liste
  const forbidden = role !== null && !!restricted && !restricted[1].includes(role);

  useEffect(() => {
    if (forbidden) router.replace("/app/sphere");
  }, [forbidden, router]);

  if (IMMERSIVE_PATHS.includes(pathname)) {
    return <div style={{ minHeight: "100vh" }}>{children}</div>;
  }

  // Écran blanc pendant la redirection — évite le flash du contenu interdit
  if (forbidden) return null;

  return <DashboardShell>{children}</DashboardShell>;
}
