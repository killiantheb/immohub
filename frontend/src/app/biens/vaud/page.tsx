import type { Metadata } from "next";
import { VillePageShared, makeVilleMetadata } from "../_components/VillePageShared";

export const metadata: Metadata = makeVilleMetadata("vaud");

export default function VaudPage() {
  return <VillePageShared slug="vaud" />;
}
