// src/app/app/(dashboard)/acheteur/page.tsx
"use client";

import { DashboardAcheteur } from "@/components/dashboards/DashboardAcheteur";
import { useUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";

export default function AcheteurDashboardPage() {
  const { user } = useAuthStore();
  const { data: profile } = useUser();
  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";
  return <DashboardAcheteur firstName={firstName} />;
}
