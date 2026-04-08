"use client";
import { useParams } from "next/navigation";
import { redirect } from "next/navigation";

export default function BienFinancesPage() {
  const { id } = useParams<{ id: string }>();
  redirect(`/app/biens/${id}?tab=stats`);
}
