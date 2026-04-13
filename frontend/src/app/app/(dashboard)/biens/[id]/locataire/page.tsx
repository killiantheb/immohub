"use client";
import { useParams } from "next/navigation";
import { TabLocataire } from "../_shared";

export default function BienLocatairePage() {
  const { id } = useParams<{ id: string }>();
  return <TabLocataire bienId={id} />;
}
