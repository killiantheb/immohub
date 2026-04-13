import { redirect } from "next/navigation";
export default function WhatsAppPage() {
  redirect("/app/communication?tab=whatsapp");
}
