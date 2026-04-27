import { redirect } from "next/navigation";

// Phase 1 : marketplace publique masquée, redirect vers landing.
// Code original conservé dans l'historique git, réactivable post-marketplace.

export default function BiensPage() {
  redirect("/");
}
