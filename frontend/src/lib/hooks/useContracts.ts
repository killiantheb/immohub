"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Contract, ContractType, PaginatedContracts } from "../types";

export const contractKeys = {
  all: ["contracts"] as const,
  list: (filters: Record<string, unknown>) => ["contracts", "list", filters] as const,
  detail: (id: string) => ["contracts", id] as const,
};

interface ContractFilters {
  status?: string;
  property_id?: string;
  tenant_id?: string;
  page?: number;
  size?: number;
}

export function useContracts(filters: ContractFilters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
  );
  return useQuery({
    queryKey: contractKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedContracts>("/contracts", { params });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: contractKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Contract>(`/contracts/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

interface ContractCreatePayload {
  property_id: string;
  tenant_id?: string | null;
  agency_id?: string | null;
  type: ContractType;
  status?: string;
  start_date: string;
  end_date?: string | null;
  monthly_rent?: number | null;
  charges?: number | null;
  deposit?: number | null;
  // Extended fields
  is_furnished?: boolean;
  payment_day?: number;
  notice_period_months?: number;
  tourist_tax_amount?: number | null;
  cleaning_fee_hourly?: number;
  linen_fee_included?: boolean;
  deposit_type?: string;
  subletting_allowed?: boolean;
  animals_allowed?: boolean;
  smoking_allowed?: boolean;
  is_for_sale?: boolean;
  signed_at_city?: string | null;
  canton?: string;
  bank_name?: string | null;
  bank_iban?: string | null;
  bank_bic?: string | null;
  occupants_count?: number | null;
  tenant_nationality?: string | null;
  payment_communication?: string | null;
}

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ContractCreatePayload) => {
      const { data } = await api.post<Contract>("/contracts", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: contractKeys.all }),
  });
}

export function useUpdateContract(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Contract>) => {
      const { data } = await api.put<Contract>(`/contracts/${id}`, payload);
      return data;
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: contractKeys.detail(id) });
      const prev = qc.getQueryData<Contract>(contractKeys.detail(id));
      if (prev) qc.setQueryData(contractKeys.detail(id), { ...prev, ...payload });
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(contractKeys.detail(id), ctx.prev);
    },
    onSuccess: (updated) => {
      qc.setQueryData(contractKeys.detail(id), updated);
      qc.invalidateQueries({ queryKey: contractKeys.all });
    },
  });
}

export function useSignContract(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Contract>(`/contracts/${id}/sign`);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(contractKeys.detail(id), updated);
      qc.invalidateQueries({ queryKey: contractKeys.all });
    },
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/contracts/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.removeQueries({ queryKey: contractKeys.detail(id) });
      qc.invalidateQueries({ queryKey: contractKeys.all });
    },
  });
}
