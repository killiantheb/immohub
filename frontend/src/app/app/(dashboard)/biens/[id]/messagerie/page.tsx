"use client";

import { useParams } from "next/navigation";
import { BienBackButton } from "@/components/biens/BienBackButton";
import { ConversationBien } from "@/components/messagerie/ConversationBien";

export default function BienMessageriePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <BienBackButton bienId={id} />
      <ConversationBien bienId={id} />
    </>
  );
}
