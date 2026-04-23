"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformStats {
  total_users: number;
  users_by_role: Record<string, number>;
  new_users_this_month: number;
  total_biens: number;
  active_biens: number;
  active_contracts: number;
  revenue_total: number;
  revenue_this_month: number;
  commissions_total: number;
  commissions_this_month: number;
  pending_transactions: number;
  late_transactions: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

export interface PaginatedUsers {
  items: AdminUser[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface AdminTransaction {
  id: string;
  reference: string;
  type: string;
  status: string;
  amount: number;
  commission_amount: number | null;
  owner_id: string;
  bien_id: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PaginatedTransactions {
  items: AdminTransaction[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  commissions: number;
  transaction_count: number;
}

export interface AdminAuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface PaginatedAuditLogs {
  items: AdminAuditLog[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// ── Keys ──────────────────────────────────────────────────────────────────────

const keys = {
  stats: ["admin", "stats"] as const,
  users: (p: number, role?: string, verified?: boolean) =>
    ["admin", "users", p, role, verified] as const,
  transactions: (p: number, type?: string, status?: string) =>
    ["admin", "transactions", p, type, status] as const,
  revenue: (months: number) => ["admin", "revenue", months] as const,
  auditLogs: (p: number) => ["admin", "audit-logs", p] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function usePlatformStats() {
  return useQuery({
    queryKey: keys.stats,
    queryFn: async () => {
      const { data } = await api.get<PlatformStats>("/admin/stats");
      return data;
    },
    staleTime: 60_000,
  });
}

export function useAdminUsers(
  page = 1,
  role?: string,
  isVerified?: boolean,
  search?: string,
) {
  return useQuery({
    queryKey: [...keys.users(page, role, isVerified), search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: "20" });
      if (role) params.set("role", role);
      if (isVerified !== undefined) params.set("is_verified", String(isVerified));
      if (search) params.set("search", search);
      const { data } = await api.get<PaginatedUsers>(`/admin/users?${params}`);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useVerifyUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.put<AdminUser>(`/admin/users/${userId}/verify`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: string;
      payload: { role?: string; is_active?: boolean };
    }) => {
      const { data } = await api.patch<AdminUser>(`/admin/users/${userId}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useAdminTransactions(page = 1, type?: string, status?: string) {
  return useQuery({
    queryKey: keys.transactions(page, type, status),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: "50" });
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      const { data } = await api.get<PaginatedTransactions>(
        `/admin/transactions?${params}`,
      );
      return data;
    },
    staleTime: 30_000,
  });
}

export function useAdminRevenue(months = 12) {
  return useQuery({
    queryKey: keys.revenue(months),
    queryFn: async () => {
      const { data } = await api.get<MonthlyRevenue[]>(
        `/admin/revenue?months=${months}`,
      );
      return data;
    },
    staleTime: 120_000,
    retry: false,
  });
}

export function useAuditLogs(page = 1) {
  return useQuery({
    queryKey: keys.auditLogs(page),
    queryFn: async () => {
      const { data } = await api.get<PaginatedAuditLogs>(
        `/admin/audit-logs?page=${page}&size=50`,
      );
      return data;
    },
    staleTime: 30_000,
  });
}
