import { redirect } from "next/navigation";
export default function MessageriePage() {
  redirect("/app/communication?tab=messages");
}
