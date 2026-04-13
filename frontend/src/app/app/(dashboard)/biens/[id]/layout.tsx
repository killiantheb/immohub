// src/app/app/(dashboard)/biens/[id]/layout.tsx
"use client";

import { useParams } from "next/navigation";
import { FilAriane } from "@/components/FilAriane";
import { BienTabs } from "@/components/BienTabs";
import { BienHeader, S } from "./_shared";

export default function BienDetailLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();

  return (
    <div style={{ background: S.bg, minHeight: "100vh" }}>
      <FilAriane items={[
        { label: "Tableau de bord", href: "/app" },
        { label: "Biens",           href: "/app/biens" },
        { label: id },
      ]} />

      <BienHeader bienId={id} />

      <BienTabs bienId={id} />

      <div style={{ maxWidth: 1040 }}>
        {children}
      </div>
    </div>
  );
}
