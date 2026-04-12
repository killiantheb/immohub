import type { Metadata } from "next";
import { VillePageShared, makeVilleMetadata } from "../_components/VillePageShared";

export const metadata: Metadata = makeVilleMetadata("lausanne");

export default function LausannePage() {
  return <VillePageShared slug="lausanne" />;
}
