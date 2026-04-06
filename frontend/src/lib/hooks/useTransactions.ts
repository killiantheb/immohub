"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { PaginatedTransactions, RevenueStats, Transaction } from "../types";

export const txKeys = {
  all: ["transactions"] as const,
  list: (f: Record<string, unknown>) => ["transactions", "list", f] as const,
  detail: (id: string) => ["transactions", id] as const,
  stats: (months: number) => ["transactions", "stats", months] as const,
};

export interface TransactionFilters {
  property_id?: string;
  contract_id?: string;
  owner_id?: string;
  month?: string;   // "YYYY-MM"
  status?: string;
  type?: string;
  page?: number;
  size?: number;
}

export function useTransactions(filters: TransactionFilters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
  );
  return useQuery({
    queryKey: txKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedTransactions>("/transactions", { params });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useRevenueStats(months = 12) {
  return useQuery({
    queryKey: txKeys.stats(months),
    queryFn: async () => {
      const { data } = await api.get<RevenueStats>("/transactions/stats", {
        params: { months },
      });
      return data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useMarkPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Transaction>(`/transactions/${id}/mark-paid`);
      return data;
    },
    // Optimistic update
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: txKeys.all });
      const listKeys = qc.getQueriesData<PaginatedTransactions>({ queryKey: ["transactions", "list"] });
      listKeys.forEach(([key, data]) => {
        if (!data) return;
        qc.setQueryData(key, {
          ...data,
          items: data.items.map((tx) => tx.id === id ? { ...tx, status: "paid" as const } : tx),
        });
      });
      return { listKeys };
    },
    onError: (_e, _id, ctx) => {
      ctx?.listKeys.forEach(([key, data]) => { if (data) qc.setQueryData(key, data); });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: txKeys.all });
    },
  });
}

export function useGenerateMonthlyRents() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ task_id: string; status: string }>(
        "/transactions/generate-monthly",
      );
      return data;
    },
  });
}
