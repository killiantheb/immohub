// src/app/app/(dashboard)/ouvreur/page.tsx
"use client";

import { DashboardOpener } from "@/components/dashboards/DashboardOpener";
import { useUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";

export default function OuvreurDashboardPage() {
  const { user } = useAuthStore();
  const { data: profile } = useUser();
  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";
  return <DashboardOpener firstName={firstName} />;
}
