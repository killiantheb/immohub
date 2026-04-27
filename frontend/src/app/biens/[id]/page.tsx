import { redirect } from "next/navigation";

// Phase 1 : fiche bien publique masquée, redirect vers landing.
// Code original conservé dans l'historique git, réactivable post-marketplace.

export default function BienDetailPage() {
  redirect("/");
}
