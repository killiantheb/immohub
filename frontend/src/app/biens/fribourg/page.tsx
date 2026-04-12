import type { Metadata } from "next";
import { VillePageShared, makeVilleMetadata } from "../_components/VillePageShared";

export const metadata: Metadata = makeVilleMetadata("fribourg");

export default function FribourgPage() {
  return <VillePageShared slug="fribourg" />;
}
