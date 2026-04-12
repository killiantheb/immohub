import type { Metadata } from "next";
import { VillePageShared, makeVilleMetadata } from "../_components/VillePageShared";

export const metadata: Metadata = makeVilleMetadata("geneve");

export default function GenevePage() {
  return <VillePageShared slug="geneve" />;
}
