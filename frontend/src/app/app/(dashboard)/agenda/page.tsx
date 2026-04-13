import { redirect } from "next/navigation";
export default function AgendaPage() {
  redirect("/app/communication?tab=agenda");
}
