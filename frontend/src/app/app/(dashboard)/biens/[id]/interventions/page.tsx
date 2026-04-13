"use client";
import { useParams } from "next/navigation";
import { TabInterventions } from "../_shared";

export default function BienInterventionsPage() {
  const { id } = useParams<{ id: string }>();
  return <TabInterventions bienId={id} />;
}
