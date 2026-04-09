"use client";

import { useRole } from "@/lib/hooks/useRole";
import { useAuthStore } from "@/lib/store/authStore";
import { useUser } from "@/lib/auth";
import { DashboardManager }  from "@/components/dashboards/DashboardManager";
import { DashboardOpener }   from "@/components/dashboards/DashboardOpener";
import { DashboardArtisan }  from "@/components/dashboards/DashboardArtisan";
import { DashboardTenant }   from "@/components/dashboards/DashboardTenant";
import { DashboardExpert }   from "@/components/dashboards/DashboardExpert";
import { DashboardHunter }   from "@/components/dashboards/DashboardHunter";
import { DashboardPortail }  from "@/components/dashboards/DashboardPortail";
import { DashboardAcheteur } from "@/components/dashboards/DashboardAcheteur";

export default function DashboardHome() {
  const { role, isOpener, isArtisan, isLocataire, isExpert, isHunter, isPortail, isAcheteur } = useRole();
  const { user } = useAuthStore();
  const { data: profile } = useUser();

  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";

  if (isOpener)   return <DashboardOpener   firstName={firstName} />;
  if (isArtisan)  return <DashboardArtisan  firstName={firstName} />;
  if (isLocataire) return <DashboardTenant  firstName={firstName} />;
  if (isExpert)   return <DashboardExpert   firstName={firstName} />;
  if (isHunter)   return <DashboardHunter   firstName={firstName} />;
  if (isPortail)  return <DashboardPortail  firstName={firstName} />;
  if (isAcheteur) return <DashboardAcheteur firstName={firstName} />;

  // proprio_solo | agence | super_admin | loading
  return <DashboardManager firstName={firstName} role={role ?? "proprio_solo"} />;
}
