import type { TransactionStatus } from "@/lib/types";
import { C } from "@/lib/design-tokens";


const CONFIG: Record<TransactionStatus, { label: string; color: string; bg: string }> = {
  paid:      { label: "Payé",       color: C.green,  bg: C.greenBg  },
  pending:   { label: "En attente", color: C.amber,  bg: C.amberBg  },
  late:      { label: "Impayé",     color: C.red,    bg: C.redBg    },
  cancelled: { label: "Annulé",     color: C.text3,  bg: C.surface2 },
};

interface Props {
  status: TransactionStatus | string;
  className?: string;
}

export function RentStatusBadge({ status, className = "" }: Props) {
  const cfg = CONFIG[status as TransactionStatus] ?? {
    label: status,
    color: C.text2,
    bg: C.surface2,
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${className}`}
      style={{ fontSize: 12, color: cfg.color, backgroundColor: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}
