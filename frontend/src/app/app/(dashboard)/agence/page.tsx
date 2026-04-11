// src/app/app/(dashboard)/agence/page.tsx
"use client";

import { DashboardAgence } from "@/components/dashboards/DashboardAgence";
import { useUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";

export default function AgenceDashboardPage() {
  const { user } = useAuthStore();
  const { data: profile } = useUser();
  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";
  return <DashboardAgence firstName={firstName} />;
}
