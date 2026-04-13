"use client";
import { useParams } from "next/navigation";
import { TabFinances } from "../_shared";

export default function BienFinancesPage() {
  const { id } = useParams<{ id: string }>();
  return <TabFinances bienId={id} />;
}
