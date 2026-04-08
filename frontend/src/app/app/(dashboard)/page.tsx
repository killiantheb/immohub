"use client";

import { useRole } from "@/lib/hooks/useRole";
import { useAuthStore } from "@/lib/store/authStore";
import { useUser } from "@/lib/auth";
import { DashboardManager } from "@/components/dashboards/DashboardManager";
import { DashboardOpener } from "@/components/dashboards/DashboardOpener";
import { DashboardArtisan } from "@/components/dashboards/DashboardArtisan";
import { DashboardTenant } from "@/components/dashboards/DashboardTenant";

export default function DashboardHome() {
  const { role } = useRole();
  const { user } = useAuthStore();
  const { data: profile } = useUser();

  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";

  if (role === "opener") {
    return <DashboardOpener firstName={firstName} />;
  }
  if (role === "company") {
    return <DashboardArtisan firstName={firstName} />;
  }
  if (role === "tenant") {
    return <DashboardTenant firstName={firstName} />;
  }
  // owner | agency | super_admin (and null while loading)
  return <DashboardManager firstName={firstName} role={role ?? "owner"} />;
}
