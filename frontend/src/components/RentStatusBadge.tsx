import type { TransactionStatus } from "@/lib/types";

const CONFIG: Record<TransactionStatus, { label: string; className: string }> = {
  paid:      { label: "Payé",    className: "bg-green-100 text-green-700" },
  pending:   { label: "En attente", className: "bg-amber-100 text-amber-700" },
  late:      { label: "Impayé",  className: "bg-red-100 text-red-700" },
  cancelled: { label: "Annulé", className: "bg-gray-100 text-gray-500" },
};

interface Props {
  status: TransactionStatus | string;
  className?: string;
}

export function RentStatusBadge({ status, className = "" }: Props) {
  const cfg = CONFIG[status as TransactionStatus] ?? {
    label: status,
    className: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.className} ${className}`}
    >
      {cfg.label}
    </span>
  );
}
