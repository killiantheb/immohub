"use client";
import { useParams } from "next/navigation";
import { TabLocataire } from "../_shared";
import { BienBackButton } from "@/components/biens/BienBackButton";

export default function BienLocatairePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <BienBackButton bienId={id} />
      <TabLocataire bienId={id} />
    </>
  );
}
