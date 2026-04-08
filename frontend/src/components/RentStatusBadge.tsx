import type { TransactionStatus } from "@/lib/types";

const S = {
  bg: "var(--althy-bg)",
  surface: "var(--althy-surface)",
  surface2: "var(--althy-surface-2)",
  border: "var(--althy-border)",
  text: "var(--althy-text)",
  text2: "var(--althy-text-2)",
  text3: "var(--althy-text-3)",
  orange: "var(--althy-orange)",
  orangeBg: "var(--althy-orange-bg)",
  green: "var(--althy-green)",
  greenBg: "var(--althy-green-bg)",
  red: "var(--althy-red)",
  redBg: "var(--althy-red-bg)",
  amber: "var(--althy-amber)",
  amberBg: "var(--althy-amber-bg)",
  blue: "var(--althy-blue)",
  blueBg: "var(--althy-blue-bg)",
  shadow: "var(--althy-shadow)",
  shadowMd: "var(--althy-shadow-md)",
} as const;

const CONFIG: Record<TransactionStatus, { label: string; color: string; bg: string }> = {
  paid:      { label: "Payé",       color: S.green,  bg: S.greenBg  },
  pending:   { label: "En attente", color: S.amber,  bg: S.amberBg  },
  late:      { label: "Impayé",     color: S.red,    bg: S.redBg    },
  cancelled: { label: "Annulé",     color: S.text3,  bg: S.surface2 },
};

interface Props {
  status: TransactionStatus | string;
  className?: string;
}

export function RentStatusBadge({ status, className = "" }: Props) {
  const cfg = CONFIG[status as TransactionStatus] ?? {
    label: status,
    color: S.text2,
    bg: S.surface2,
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
