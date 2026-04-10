"use client";

import { useRouter } from "next/navigation";
import {
  Wrench, Search, FileText, Folder, Mail, CreditCard,
  TrendingUp, BarChart2, CheckCircle, X, Edit,
} from "lucide-react";
import type { SphereAction } from "@/lib/store/sphereStore";

const ICON_MAP: Record<string, React.ReactNode> = {
  "wrench":       <Wrench size={15} />,
  "search":       <Search size={15} />,
  "file-text":    <FileText size={15} />,
  "folder":       <Folder size={15} />,
  "mail":         <Mail size={15} />,
  "credit-card":  <CreditCard size={15} />,
  "trending-up":  <TrendingUp size={15} />,
  "bar-chart":    <BarChart2 size={15} />,
};

interface Props {
  actions: SphereAction[];
  onConfirm?: (action: SphereAction) => void;
  onDismiss?: () => void;
}

export function ActionCard({ actions, onConfirm, onDismiss }: Props) {
  const router = useRouter();

  function handleAction(action: SphereAction) {
    if (action.requires_validation && onConfirm) {
      onConfirm(action);
    } else {
      if (action.path) router.push(action.path);
    }
  }

  if (!actions.length) return null;

  return (
    <div
      style={{
        background: "var(--althy-surface)",
        border: "1px solid var(--althy-border)",
        borderRadius: 14,
        padding: "14px 16px",
        boxShadow: "var(--althy-shadow-md)",
        animation: "slideUp 0.3s ease",
        width: "100%",
      }}
    >
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--althy-text-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Actions suggérées
        </span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--althy-text-3)", padding: 2 }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              border: action.requires_validation
                ? "1px solid var(--althy-orange)"
                : "1px solid var(--althy-border)",
              background: action.requires_validation
                ? "var(--althy-orange-bg)"
                : "var(--althy-surface-2)",
              color: action.requires_validation
                ? "var(--althy-orange)"
                : "var(--althy-text-2)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {(action.icon ? ICON_MAP[action.icon] : null) ?? <CheckCircle size={15} />}
            {action.label}
            {action.requires_validation && (
              <span style={{ fontSize: 10, opacity: 0.7 }}>• validation requise</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Confirmation dialog (requires_validation) ─────────────────────────────────

interface ConfirmProps {
  action: SphereAction;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ActionConfirmDialog({ action, onConfirm, onCancel }: ConfirmProps) {
  const router = useRouter();

  function confirm() {
    onConfirm();
    if (action.path) router.push(action.path);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(61,56,48,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
        animation: "fadeIn 0.2s ease",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--althy-surface)",
          borderRadius: 16,
          padding: "28px 24px",
          maxWidth: 400,
          width: "100%",
          boxShadow: "var(--althy-shadow-lg)",
          animation: "slideUp 0.25s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--althy-text)", marginBottom: 8 }}>
          Confirmer l&apos;action
        </div>
        <p style={{ fontSize: 13.5, color: "var(--althy-text-2)", marginBottom: 20 }}>
          Althy va exécuter : <strong>{action.label}</strong>.<br />
          Cette action nécessite votre validation.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "8px 16px", borderRadius: 8,
              border: "1px solid var(--althy-border)",
              background: "var(--althy-surface-2)",
              color: "var(--althy-text-2)", fontSize: 13, cursor: "pointer",
            }}
          >
            <X size={13} /> Annuler
          </button>
          <button
            onClick={confirm}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "8px 16px", borderRadius: 8,
              border: "1px solid var(--althy-orange)",
              background: "var(--althy-orange)",
              color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <CheckCircle size={13} /> Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
