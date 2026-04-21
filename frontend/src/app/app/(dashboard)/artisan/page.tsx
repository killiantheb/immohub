"use client";

import { UnifiedDashboard } from "@/components/dashboards/UnifiedDashboard";
import { ComingSoon } from "@/components/ComingSoon";
import { FLAGS } from "@/lib/flags";

export default function ArtisanPage() {
  if (!FLAGS.ROLE_ARTISAN) {
    return <ComingSoon title="Espace Artisan en préparation" phase="Phase 3" />;
  }
  return <UnifiedDashboard />;
}
