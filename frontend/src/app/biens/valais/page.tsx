import type { Metadata } from "next";
import { VillePageShared, makeVilleMetadata } from "../_components/VillePageShared";

export const metadata: Metadata = makeVilleMetadata("valais");

export default function ValaisPage() {
  return <VillePageShared slug="valais" />;
}
