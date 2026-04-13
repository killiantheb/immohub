"use client";
import { useParams } from "next/navigation";
import { TabPotentielIA } from "../_shared";

export default function BienPotentielPage() {
  const { id } = useParams<{ id: string }>();
  return <TabPotentielIA bienId={id} />;
}
