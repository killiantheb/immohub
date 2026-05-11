"use client";

/**
 * BienSidebar — navigation contextuelle de la fiche bien.
 *
 * Sidebar gauche persistante sur /app/biens/[id] et ses sous-pages
 * (locataire, documents, finances, interventions, historique, potentiel,
 * changement). Pattern Airbnb « outil de modification d'annonce » : contenu
 * central change selon la section active, sidebar reste stable.
 *
 * Doctrine :
 *  - §B.4 palette : bleu de Prusse + or, aucun #E8602C orange.
 *  - §B.10 pas de faux statut : les 8 entrées pointent vers des pages
 *    réellement implémentées (cf audit pré-PR du 2026-05-11).
 *  - 4-PRODUIT.md §4.6 « cards (pas tabs) » → la sidebar n'est PAS des
 *    tabs au-dessus du contenu, c'est une nav latérale. La vue overview
 *    reste en cards dans le contenu central.
 *
 * Mobile : contrôlé par le parent via `mobileOpen` + `onMobileClose`.
 * Pattern aligné avec DashboardShell (state mobile pushé dans le shell).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  History,
  LayoutGrid,
  RefreshCw,
  Sparkles,
  User,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { useBien } from "@/lib/hooks/useBiens";
import { C } from "@/lib/design-tokens";

interface Section {
  key: string;
  label: string;
  build: (bienId: string) => string;
  icon: React.ElementType;
}

const SECTIONS: readonly Section[] = [
  { key: "overview",      label: "Vue d'ensemble", build: (id) => `/app/biens/${id}`,                icon: LayoutGrid },
  { key: "locataire",     label: "Locataire",      build: (id) => `/app/biens/${id}/locataire`,      icon: User },
  { key: "documents",     label: "Documents",      build: (id) => `/app/biens/${id}/documents`,      icon: FileText },
  { key: "finances",      label: "Finances",       build: (id) => `/app/biens/${id}/finances`,       icon: Wallet },
  { key: "interventions", label: "Interventions",  build: (id) => `/app/biens/${id}/interventions`,  icon: Wrench },
  { key: "historique",    label: "Historique",     build: (id) => `/app/biens/${id}/historique`,     icon: History },
  { key: "potentiel",     label: "Potentiel IA",   build: (id) => `/app/biens/${id}/potentiel`,      icon: Sparkles },
  { key: "changement",    label: "Changement",     build: (id) => `/app/biens/${id}/changement`,     icon: RefreshCw },
];

const ICON = { size: 16, strokeWidth: 1.6 } as const;

interface Props {
  bienId: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function BienSidebar({ bienId, mobileOpen = false, onMobileClose }: Props) {
  const pathname = usePathname();
  const { data: bien } = useBien(bienId);

  const overviewHref = `/app/biens/${bienId}`;
  const isActive = (href: string) =>
    href === overviewHref
      ? pathname === overviewHref
      : pathname === href || pathname.startsWith(href + "/");

  const cover = bien?.images?.[0]?.url ?? null;
  const villeLine = bien
    ? [bien.cp, bien.ville].filter(Boolean).join(" ").trim()
    : "";

  return (
    <>
      {mobileOpen && (
        <div
          aria-hidden
          onClick={onMobileClose}
          className="bien-sidebar-backdrop"
        />
      )}

      <aside
        className={`bien-sidebar${mobileOpen ? " bien-sidebar--open" : ""}`}
        aria-label="Navigation du bien"
      >
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Fermer la navigation"
          className="bien-sidebar__close"
        >
          <X size={18} />
        </button>

        <header
          style={{
            padding: "20px 20px 16px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div
            aria-hidden
            style={{
              width: "100%",
              height: 96,
              borderRadius: 10,
              marginBottom: 12,
              background: cover
                ? `url(${cover}) center/cover no-repeat`
                : `linear-gradient(135deg, ${C.prussian} 0%, ${C.signature} 100%)`,
              border: `1px solid ${C.border}`,
            }}
          />
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: C.text,
              lineHeight: 1.35,
            }}
          >
            {bien?.adresse ?? "…"}
          </div>
          {villeLine && (
            <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>
              {villeLine}
            </div>
          )}
        </header>

        <nav
          style={{
            padding: "12px 12px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const href = s.build(bienId);
            const active = isActive(href);
            return (
              <Link
                key={s.key}
                href={href}
                onClick={onMobileClose}
                aria-current={active ? "page" : undefined}
                className="bien-sidebar__item"
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "9px 12px 9px 16px",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 13.5,
                  fontWeight: active ? 600 : 500,
                  color: active ? C.prussian : C.text2,
                  background: active ? C.goldBg : "transparent",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {active && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 4,
                      top: 8,
                      bottom: 8,
                      width: 3,
                      borderRadius: 3,
                      background: C.gold,
                    }}
                  />
                )}
                <Icon {...ICON} />
                <span>{s.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
