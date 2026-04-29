"use client";
import { useParams } from "next/navigation";
import { TabHistorique } from "../_shared";
import { BienBackButton } from "@/components/biens/BienBackButton";

export default function BienHistoriquePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <BienBackButton bienId={id} />
      <TabHistorique bienId={id} />
    </>
  );
}
