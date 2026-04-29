"use client";
import { useParams } from "next/navigation";
import { TabFinances } from "../_shared";
import { BienBackButton } from "@/components/biens/BienBackButton";

export default function BienFinancesPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <BienBackButton bienId={id} />
      <TabFinances bienId={id} />
    </>
  );
}
