"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  ShieldBan,
  ShieldCheck,
  UserCog,
  XCircle,
} from "lucide-react";
import {
  useAdminUsers,
  useUpdateUser,
  useVerifyUser,
  type AdminUser,
} from "@/lib/hooks/useAdmin";

// ── Design tokens ─────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  agency: "Agence",
  owner: "Propriétaire",
  tenant: "Locataire",
  opener: "Ouvreur",
  company: "Entreprise",
};

type RoleKey = "super_admin" | "agency" | "owner" | "tenant" | "opener" | "company";

const ROLE_BADGE_STYLES: Record<RoleKey, { bg: string; color: string }> = {
  super_admin: { bg: S.redBg, color: S.red },
  agency: { bg: S.orangeBg, color: S.orange },
  owner: { bg: S.orangeBg, color: S.orange },
  tenant: { bg: S.greenBg, color: S.green },
  opener: { bg: S.orangeBg, color: S.orange },
  company: { bg: S.amberBg, color: S.amber },
};

function RoleBadge({ role }: { role: string }) {
  const style = ROLE_BADGE_STYLES[role as RoleKey] ?? { bg: S.surface2, color: S.text2 };
  return (
    <span
      style={{
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 12,
        fontWeight: 500,
        background: style.bg,
        color: style.color,
        display: "inline-block",
      }}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

// ── Role change modal ─────────────────────────────────────────────────────────

function RoleModal({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const update = useUpdateUser();
  const [role, setRole] = useState(user.role);

  const roles = ["super_admin", "agency", "owner", "tenant", "opener", "company"] as const;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 384,
          borderRadius: 20,
          background: S.surface,
          padding: "24px",
          boxShadow: S.shadowMd,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, color: S.text }}>Changer le rôle</h3>
        <p style={{ marginTop: 4, fontSize: 13, color: S.text2 }}>{user.email}</p>
        <div style={{ marginTop: 16 }} className="space-y-2">
          {roles.map((r) => (
            <label
              key={r}
              style={{
                display: "flex",
                cursor: "pointer",
                alignItems: "center",
                gap: 12,
                borderRadius: 12,
                border: `1px solid ${S.border}`,
                padding: "10px 12px",
                transition: "background 0.15s",
              }}
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                style={{ accentColor: S.orange }}
              />
              <RoleBadge role={r} />
            </label>
          ))}
        </div>
        <div style={{ marginTop: 20 }} className="flex justify-end gap-2">
          <button
            onClick={onClose}
            style={{
              borderRadius: 12,
              border: `1px solid ${S.border}`,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              color: S.text2,
              background: S.surface,
              cursor: "pointer",
            }}
          >
            Annuler
          </button>
          <button
            disabled={update.isPending}
            onClick={async () => {
              await update.mutateAsync({ userId: user.id, payload: { role } });
              onClose();
            }}
            style={{
              borderRadius: 12,
              background: S.orange,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              color: "#fff",
              cursor: "pointer",
              opacity: update.isPending ? 0.6 : 1,
            }}
          >
            {update.isPending ? "Enregistrement…" : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | undefined>();
  const [search, setSearch] = useState("");
  const [roleModal, setRoleModal] = useState<AdminUser | null>(null);

  const { data, isLoading } = useAdminUsers(page, roleFilter, verifiedFilter, search || undefined);
  const verifyUser = useVerifyUser();
  const updateUser = useUpdateUser();

  const roles = ["super_admin", "agency", "owner", "tenant", "opener", "company"];

  const inputStyle = {
    borderRadius: 12,
    border: `1px solid ${S.border}`,
    background: S.surface,
    padding: "8px 12px",
    fontSize: 14,
    color: S.text,
    outline: "none",
  };

  return (
    <div className="space-y-6">
      {roleModal && (
        <RoleModal user={roleModal} onClose={() => setRoleModal(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/app/admin"
            style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 4, fontSize: 14, color: S.text2, textDecoration: "none" }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            Retour à l&apos;admin
          </Link>
          <h1
            style={{
              fontFamily: "var(--font-serif),'Cormorant Garamond',serif",
              fontWeight: 400,
              fontSize: 24,
              color: S.text,
            }}
          >
            Gestion des utilisateurs
          </h1>
          <p style={{ fontSize: 14, color: S.text2 }}>
            {data ? `${data.total} utilisateurs` : "Chargement…"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div style={{ position: "relative" }}>
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: S.text3 }} />
          <input
            type="text"
            placeholder="Rechercher email, nom…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ ...inputStyle, paddingLeft: 36, width: 224 }}
          />
        </div>

        <select
          value={roleFilter ?? ""}
          onChange={(e) => { setRoleFilter(e.target.value || undefined); setPage(1); }}
          style={inputStyle}
        >
          <option value="">Tous les rôles</option>
          {roles.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
          ))}
        </select>

        <select
          value={verifiedFilter === undefined ? "" : String(verifiedFilter)}
          onChange={(e) => {
            setVerifiedFilter(e.target.value === "" ? undefined : e.target.value === "true");
            setPage(1);
          }}
          style={inputStyle}
        >
          <option value="">Tout statut</option>
          <option value="true">Vérifiés</option>
          <option value="false">Non vérifiés</option>
        </select>
      </div>

      {/* Table */}
      <div
        style={{
          overflow: "hidden",
          borderRadius: 20,
          border: `1px solid ${S.border}`,
          background: S.surface,
          boxShadow: S.shadow,
        }}
      >
        <table className="w-full" style={{ fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${S.border}`, background: S.surface2 }}>
              {["Utilisateur", "Rôle", "Statut", "Inscription", "Actions"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    padding: "14px 20px",
                    textAlign: i === 4 ? "right" : "left",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: S.text3,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} style={{ padding: "14px 20px" }}>
                        <div
                          className="animate-pulse"
                          style={{ height: 14, width: 96, borderRadius: 6, background: S.surface2 }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.items.map((user) => (
                  <tr
                    key={user.id}
                    style={{ borderBottom: `1px solid ${S.border}` }}
                  >
                    <td style={{ padding: "14px 20px" }}>
                      <div>
                        <p style={{ fontWeight: 500, color: S.text }}>
                          {user.first_name || user.last_name
                            ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
                            : "—"}
                        </p>
                        <p style={{ fontSize: 12, color: S.text3 }}>{user.email}</p>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <RoleBadge role={user.role} />
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div className="flex flex-col gap-1">
                        {user.is_verified ? (
                          <span className="flex items-center gap-1" style={{ fontSize: 12, color: S.green }}>
                            <CheckCircle2 style={{ width: 14, height: 14 }} /> Vérifié
                          </span>
                        ) : (
                          <span className="flex items-center gap-1" style={{ fontSize: 12, color: S.amber }}>
                            <XCircle style={{ width: 14, height: 14 }} /> Non vérifié
                          </span>
                        )}
                        {!user.is_active && (
                          <span className="flex items-center gap-1" style={{ fontSize: 12, color: S.red }}>
                            <ShieldBan style={{ width: 14, height: 14 }} /> Suspendu
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: S.text3 }}>
                      {new Date(user.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div className="flex items-center justify-end gap-2">
                        {!user.is_verified && (
                          <button
                            disabled={verifyUser.isPending}
                            onClick={() => verifyUser.mutate(user.id)}
                            title="Vérifier le compte"
                            style={{
                              borderRadius: 8,
                              padding: 6,
                              color: S.green,
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              opacity: verifyUser.isPending ? 0.5 : 1,
                              transition: "background 0.15s",
                            }}
                          >
                            <ShieldCheck style={{ width: 16, height: 16 }} />
                          </button>
                        )}
                        <button
                          onClick={() => setRoleModal(user)}
                          title="Changer le rôle"
                          style={{
                            borderRadius: 8,
                            padding: 6,
                            color: S.orange,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                        >
                          <UserCog style={{ width: 16, height: 16 }} />
                        </button>
                        <button
                          disabled={updateUser.isPending}
                          onClick={() =>
                            updateUser.mutate({
                              userId: user.id,
                              payload: { is_active: !user.is_active },
                            })
                          }
                          title={user.is_active ? "Suspendre" : "Réactiver"}
                          style={{
                            borderRadius: 8,
                            padding: 6,
                            color: user.is_active ? S.red : S.green,
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            opacity: updateUser.isPending ? 0.5 : 1,
                            transition: "background 0.15s",
                          }}
                        >
                          {user.is_active ? (
                            <ShieldBan style={{ width: 16, height: 16 }} />
                          ) : (
                            <CheckCircle2 style={{ width: 16, height: 16 }} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div
            className="flex items-center justify-between"
            style={{ borderTop: `1px solid ${S.border}`, padding: "12px 20px" }}
          >
            <p style={{ fontSize: 12, color: S.text3 }}>
              Page {data.page} / {data.pages} — {data.total} résultats
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${S.border}`,
                  padding: 6,
                  background: S.surface,
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  opacity: page <= 1 ? 0.4 : 1,
                  color: S.text,
                }}
              >
                <ChevronLeft style={{ width: 16, height: 16 }} />
              </button>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${S.border}`,
                  padding: 6,
                  background: S.surface,
                  cursor: page >= data.pages ? "not-allowed" : "pointer",
                  opacity: page >= data.pages ? 0.4 : 1,
                  color: S.text,
                }}
              >
                <ChevronRight style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
