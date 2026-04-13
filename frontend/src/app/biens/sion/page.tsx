import type { Metadata } from "next";
import { VillePageShared, makeVilleMetadata } from "../_components/VillePageShared";

export const metadata: Metadata = makeVilleMetadata("sion");

export default function SionPage() {
  return <VillePageShared slug="sion" />;
}
