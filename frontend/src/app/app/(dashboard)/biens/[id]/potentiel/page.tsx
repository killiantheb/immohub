"use client";
import { useParams } from "next/navigation";
import { TabPotentielIA } from "../_shared";
import { BienBackButton } from "@/components/biens/BienBackButton";

export default function BienPotentielPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <BienBackButton bienId={id} />
      <TabPotentielIA bienId={id} />
    </>
  );
}
