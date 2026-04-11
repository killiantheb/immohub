// src/app/app/(dashboard)/artisan/page.tsx
"use client";

import { DashboardArtisan } from "@/components/dashboards/DashboardArtisan";
import { useUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";

export default function ArtisanDashboardPage() {
  const { user } = useAuthStore();
  const { data: profile } = useUser();
  const firstName = profile?.first_name ?? user?.user_metadata?.first_name ?? "";
  return <DashboardArtisan firstName={firstName} />;
}
