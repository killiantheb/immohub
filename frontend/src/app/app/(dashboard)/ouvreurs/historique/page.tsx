"use client";

import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/ComingSoon";
import { FLAGS } from "@/lib/flags";

export default function OuvreursHistoriquePage() {
  if (!FLAGS.ROLE_OPENER) {
    return <ComingSoon title="Historique Ouvreur en préparation" phase="Phase 3" />;
  }
  redirect("/app/ouvreurs");
}
