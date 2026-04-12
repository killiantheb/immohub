import type { Metadata } from "next";
import { VillePageShared, makeVilleMetadata } from "../_components/VillePageShared";

export const metadata: Metadata = makeVilleMetadata("neuchatel");

export default function NeuchatelPage() {
  return <VillePageShared slug="neuchatel" />;
}
