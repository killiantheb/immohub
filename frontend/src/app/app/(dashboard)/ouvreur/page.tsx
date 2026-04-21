"use client";

import { UnifiedDashboard } from "@/components/dashboards/UnifiedDashboard";
import { ComingSoon } from "@/components/ComingSoon";
import { FLAGS } from "@/lib/flags";

export default function OuvreurPage() {
  if (!FLAGS.ROLE_OPENER) {
    return <ComingSoon title="Espace Ouvreur en préparation" phase="Phase 3" />;
  }
  return <UnifiedDashboard />;
}
