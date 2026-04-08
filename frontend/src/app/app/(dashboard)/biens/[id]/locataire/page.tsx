"use client";
import { useParams } from "next/navigation";
import { redirect } from "next/navigation";

// Redirect to property detail with tenants tab pre-selected
export default function BienLocatairePage() {
  const { id } = useParams<{ id: string }>();
  redirect(`/app/biens/${id}?tab=tenants`);
}
