"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useAuth, useUser } from "@/lib/auth";
import { useAuthStore } from "@/lib/store/authStore";
import { useRole } from "@/lib/hooks/useRole";
import { C } from "@/lib/design-tokens";

/**
 * UserMenu — bouton avatar top-right + dropdown profil unifié.
 *
 * Sprint 9 Lot C : doublon profil supprimé. La sidebar n'expose plus
 * "Mon profil" en bas ; toutes les actions liées à l'utilisateur passent
 * désormais par ce dropdown.
 *
 * Items :
 *   - Mon profil    → /app/profil  (lecture seule)
 *   - Paramètres    → /app/settings
 *   - Aide          → ComingSoon Phase 1.1 (pas de route dédiée)
 *   - Déconnexion   → signOut + redirect /login
 */
export function UserMenu() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useAuthStore();
  const { data: profile } = useUser();
  const { label: roleLabel } = useRole();

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const firstName =
    profile?.first_name ?? user?.user_metadata?.first_name ?? "";
  const lastName =
    profile?.last_name ?? user?.user_metadata?.last_name ?? "";
  const initial = firstName ? firstName[0].toUpperCase() : "?";
  const displayName = firstName || lastName
    ? `${firstName}${firstName && lastName ? " " : ""}${lastName}`.trim()
    : (user?.email ?? "Utilisateur");

  // Fermer le dropdown au clic hors composant + touche Échap
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    try {
      await signOut();
    } catch {
      /* ignore */
    }
    router.push("/login");
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: "4px 8px 4px 4px",
          borderRadius: 12,
          fontFamily: "inherit",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, var(--althy-gold), var(--althy-prussian))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
            {initial}
          </span>
        </div>
        <div style={{ textAlign: "left", lineHeight: 1.2 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--charcoal, var(--althy-text))",
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--text-tertiary, var(--althy-text-3))",
            }}
          >
            {roleLabel ?? ""}
          </div>
        </div>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          style={{
            color: "var(--text-tertiary, var(--althy-text-3))",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            minWidth: 240,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(15,46,76,0.12)",
            overflow: "hidden",
            zIndex: 60,
          }}
        >
          {/* Header — résumé identité */}
          <div
            style={{
              padding: "12px 14px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
              }}
            >
              {displayName}
            </div>
            <div style={{ fontSize: 11, color: C.text3 }}>
              {user?.email ?? ""}
            </div>
          </div>

          <MenuItem
            icon={<User size={15} strokeWidth={1.5} />}
            label="Mon profil"
            onClick={() => go("/app/profil")}
          />
          <MenuItem
            icon={<Settings size={15} strokeWidth={1.5} />}
            label="Paramètres"
            onClick={() => go("/app/settings")}
          />
          <MenuItem
            icon={<HelpCircle size={15} strokeWidth={1.5} />}
            label="Aide"
            onClick={() => go("/app/aide")}
          />
          <div style={{ height: 1, background: C.border, margin: "4px 0" }} />
          <MenuItem
            icon={<LogOut size={15} strokeWidth={1.5} />}
            label="Déconnexion"
            onClick={handleLogout}
            danger
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const color = danger ? "#A33B2A" : C.text;
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 13,
        color,
        textAlign: "left",
        transition: "background 0.12s",
      }}
      onMouseEnter={e =>
        (e.currentTarget.style.background = "var(--althy-prussian-bg, rgba(15,46,76,0.05))")
      }
      onMouseLeave={e =>
        (e.currentTarget.style.background = "transparent")
      }
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export default UserMenu;
