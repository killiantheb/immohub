"use client";
import { useParams } from "next/navigation";
import { redirect } from "next/navigation";

export default function BienHistoriquePage() {
  const { id } = useParams<{ id: string }>();
  redirect(`/app/biens/${id}?tab=history`);
}
