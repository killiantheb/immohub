// src/app/app/(dashboard)/page.tsx
"use client";

import { useRole } from "@/lib/hooks/useRole";
import { useAuthStore } from "@/lib/store/authStore";
import { useUser } from "@/lib/auth";
import { DashboardManager }  from "@/components/dashboards/DashboardManager";
import { DashboardAgence }   from "@/components/dashboards/DashboardAgence";
import { DashboardOpener }   from "@/components/dashboards/DashboardOpener";
import { DashboardArtisan }  from "@/components/dashboards/DashboardArtisan";
import { DashboardTenant }   from "@/components/dashboards/DashboardTenant";
import { DashboardExpert }   from "@/components/dashboards/DashboardExpert";
import { DashboardHunter }   from "@/components/dashboards/DashboardHunter";
import { DashboardPortail }  from "@/components/dashboards/DashboardPortail";
import { DashboardAcheteur } from "@/components/dashboards/DashboardAcheteur";

export default function DashboardHome() {
  const {
    role,
    isOpener,
    isArtisan,
    isLocataire,
    isExpert,
    isHunter,
    isPortail,
    isAcheteur,
    isAgence,
  } = useRole();

  const { user } = useAuthStore();
  const { data: profile } = useUser();

  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";

  let content: React.ReactNode;

  if (isOpener)         content = <DashboardOpener   firstName={firstName} />;
  else if (isArtisan)   content = <DashboardArtisan  firstName={firstName} />;
  else if (isLocataire) content = <DashboardTenant   firstName={firstName} />;
  else if (isExpert)    content = <DashboardExpert   firstName={firstName} />;
  else if (isHunter)    content = <DashboardHunter   firstName={firstName} />;
  else if (isPortail)   content = <DashboardPortail  firstName={firstName} />;
  else if (isAcheteur)  content = <DashboardAcheteur firstName={firstName} />;
  else if (isAgence)    content = <DashboardAgence   firstName={firstName} />;
  else                  content = <DashboardManager  firstName={firstName} role={role ?? "proprio_solo"} />;

  return content;
}
