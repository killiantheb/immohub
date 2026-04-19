// src/app/app/(dashboard)/biens/[id]/layout.tsx
"use client";

import { useParams, usePathname } from "next/navigation";
import { FilAriane } from "@/components/FilAriane";
import { BienTabs } from "@/components/BienTabs";
import { BienHeader } from "./_shared";
import { useBien } from "@/lib/hooks/useBiens";
import { C } from "@/lib/design-tokens";

export default function BienDetailLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const { data: bien } = useBien(id);

  // Sur la vue d'ensemble, BienHeader est remplacé par les cards éditables
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

      {!isOverview && <BienHeader bienId={id} />}

      <BienTabs bienId={id} />

      <div style={{ maxWidth: 1100 }}>
        {children}
      </div>
    </div>
  );
}
