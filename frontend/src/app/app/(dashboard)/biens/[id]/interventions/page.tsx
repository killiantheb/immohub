"use client";
import { useParams } from "next/navigation";
import { TabInterventions } from "../_shared";
import { BienBackButton } from "@/components/biens/BienBackButton";

export default function BienInterventionsPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <BienBackButton bienId={id} />
      <TabInterventions bienId={id} />
    </>
  );
}
