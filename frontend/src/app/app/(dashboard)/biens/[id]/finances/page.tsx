"use client";
import { useParams } from "next/navigation";
import { BienBackButton } from "@/components/biens/BienBackButton";
import { FinancesLoyersBailleur } from "@/components/loyers/FinancesLoyersBailleur";

export default function BienFinancesPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <BienBackButton bienId={id} />
      <FinancesLoyersBailleur bienId={id} />
    </>
  );
}
