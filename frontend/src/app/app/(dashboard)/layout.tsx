"use client";

import { usePathname } from "next/navigation";
import { DashboardLayoutClient } from "@/components/DashboardLayoutClient";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // La Sphère est immersive — pas de sidebar
  if (pathname === "/app/sphere") {
    return <>{children}</>;
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
