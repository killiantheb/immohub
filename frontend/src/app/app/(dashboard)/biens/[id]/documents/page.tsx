"use client";
import { useParams } from "next/navigation";
import { TabDocuments } from "../_shared";

export default function BienDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  return <TabDocuments bienId={id} />;
}
