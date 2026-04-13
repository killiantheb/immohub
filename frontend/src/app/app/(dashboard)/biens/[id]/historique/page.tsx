"use client";
import { useParams } from "next/navigation";
import { TabHistorique } from "../_shared";

export default function BienHistoriquePage() {
  const { id } = useParams<{ id: string }>();
  return <TabHistorique bienId={id} />;
}
