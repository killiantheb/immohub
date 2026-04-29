"use client";
import { useParams } from "next/navigation";
import { TabDocuments } from "../_shared";
import { BienBackButton } from "@/components/biens/BienBackButton";

export default function BienDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <BienBackButton bienId={id} />
      <TabDocuments bienId={id} />
    </>
  );
}
