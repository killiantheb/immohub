// src/app/app/(dashboard)/expert/page.tsx
"use client";

import { DashboardExpert } from "@/components/dashboards/DashboardExpert";
import { useUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";

export default function ExpertDashboardPage() {
  const { user } = useAuthStore();
  const { data: profile } = useUser();
  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";
  return <DashboardExpert firstName={firstName} />;
}
