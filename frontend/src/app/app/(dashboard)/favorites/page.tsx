import { redirect } from "next/navigation";
export default function FavoritesPage() {
  redirect("/app/biens?tab=favoris");
}
