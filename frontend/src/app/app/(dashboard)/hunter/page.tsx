// src/app/app/(dashboard)/hunter/page.tsx
"use client";

import { DashboardHunter } from "@/components/dashboards/DashboardHunter";
import { useUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";

export default function HunterDashboardPage() {
  const { user } = useAuthStore();
  const { data: profile } = useUser();
  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";
  return <DashboardHunter firstName={firstName} />;
}
