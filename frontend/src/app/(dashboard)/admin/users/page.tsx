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

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  agency: "Agence",
  owner: "Propriétaire",
  tenant: "Locataire",
  opener: "Ouvreur",
  company: "Entreprise",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-red-100 text-red-700",
  agency: "bg-indigo-100 text-indigo-700",
  owner: "bg-orange-100 text-orange-700",
  tenant: "bg-emerald-100 text-emerald-700",
  opener: "bg-purple-100 text-purple-700",
  company: "bg-amber-100 text-amber-700",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role] ?? "bg-gray-100 text-gray-600"}`}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-gray-900">Changer le rôle</h3>
        <p className="mt-1 text-sm text-gray-500">{user.email}</p>
        <div className="mt-4 space-y-2">
          {roles.map((r) => (
            <label
              key={r}
              className="flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-gray-50"
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                className="accent-orange-600"
              />
              <RoleBadge role={r} />
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            disabled={update.isPending}
            onClick={async () => {
              await update.mutateAsync({ userId: user.id, payload: { role } });
              onClose();
            }}
            className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
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

  return (
    <div className="space-y-6">
      {roleModal && (
        <RoleModal user={roleModal} onClose={() => setRoleModal(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin" className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;admin
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="text-sm text-gray-500">
            {data ? `${data.total} utilisateurs` : "Chargement…"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher email, nom…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-orange-400 w-56"
          />
        </div>

        <select
          value={roleFilter ?? ""}
          onChange={(e) => { setRoleFilter(e.target.value || undefined); setPage(1); }}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
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
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400"
        >
          <option value="">Tout statut</option>
          <option value="true">Vérifiés</option>
          <option value="false">Non vérifiés</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                Utilisateur
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                Rôle
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                Statut
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                Inscription
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5">
                        <div className="h-3.5 w-24 animate-pulse rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.items.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-50 transition-colors hover:bg-gray-50/50"
                  >
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.first_name || user.last_name
                            ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
                            : "—"}
                        </p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        {user.is_verified ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Vérifié
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <XCircle className="h-3.5 w-3.5" /> Non vérifié
                          </span>
                        )}
                        {!user.is_active && (
                          <span className="flex items-center gap-1 text-xs text-red-500">
                            <ShieldBan className="h-3.5 w-3.5" /> Suspendu
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-400">
                      {new Date(user.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {!user.is_verified && (
                          <button
                            disabled={verifyUser.isPending}
                            onClick={() => verifyUser.mutate(user.id)}
                            title="Vérifier le compte"
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setRoleModal(user)}
                          title="Changer le rôle"
                          className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <UserCog className="h-4 w-4" />
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
                          className={`rounded-lg p-1.5 transition-colors disabled:opacity-50 ${
                            user.is_active
                              ? "text-red-500 hover:bg-red-50"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          {user.is_active ? (
                            <ShieldBan className="h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
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
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
            <p className="text-xs text-gray-400">
              Page {data.page} / {data.pages} — {data.total} résultats
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
