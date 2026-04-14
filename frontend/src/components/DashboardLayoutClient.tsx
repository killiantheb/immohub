"use client";

import { usePathname } from "next/navigation";
import { DashboardShell } from "./DashboardShell";

const IMMERSIVE_PATHS = ["/app/sphere"];

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (IMMERSIVE_PATHS.includes(pathname)) {
    return <div style={{ minHeight: "100vh" }}>{children}</div>;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
