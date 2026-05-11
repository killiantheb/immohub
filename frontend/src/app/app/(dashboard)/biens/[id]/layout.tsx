// src/app/app/(dashboard)/biens/[id]/layout.tsx
"use client";

import { useState } from "react";
import { useParams, usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { FilAriane } from "@/components/FilAriane";
import { BienHeader } from "./_shared";
import { BienSidebar } from "@/components/biens/BienSidebar";
import { useBien } from "@/lib/hooks/useBiens";
import { C } from "@/lib/design-tokens";

export default function BienDetailLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { data: bien } = useBien(id);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // BienSidebar (Sprint nav 2026-05-11) fournit la nav latérale Airbnb-style
  // commune à l'overview + 7 sous-pages. BienHeader reste rendu sur les
  // sous-pages : le header de la sidebar montre adresse + ville en compact,
  // BienHeader donne le contexte complet (titre, statut, photo) en haut du
  // contenu. Réconciliation/dédup éventuelle = PR 2 polish.
  const isOverview = pathname === `/app/biens/${id}`;

  const adresseLabel = bien
    ? `${bien.adresse}, ${bien.ville}`
    : "…";

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>
      <FilAriane items={[
        { label: "Tableau de bord", href: "/app" },
        { label: "Biens",           href: "/app/biens" },
        { label: adresseLabel },
      ]} />

      <div style={{ display: "flex", alignItems: "flex-start" }}>
        <BienSidebar
          bienId={id}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />

        <main style={{ flex: 1, minWidth: 0 }}>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir la navigation du bien"
            className="bien-sidebar-trigger"
          >
            <Menu size={16} />
            <span>Sections</span>
          </button>

          {!isOverview && <BienHeader bienId={id} />}
          <div style={{ maxWidth: 1400, marginLeft: "auto", marginRight: "auto" }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
