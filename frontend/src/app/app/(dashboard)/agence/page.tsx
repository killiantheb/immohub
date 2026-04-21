"use client";

import { UnifiedDashboard } from "@/components/dashboards/UnifiedDashboard";
import { ComingSoon } from "@/components/ComingSoon";
import { FLAGS } from "@/lib/flags";

export default function AgencePage() {
  if (!FLAGS.ROLE_AGENCE) {
    return <ComingSoon title="Espace Agence en préparation" phase="Phase 2" />;
  }
  return <UnifiedDashboard />;
}
