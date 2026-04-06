"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  siret: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zip_code: string | null;
  country: string;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface CompanyCreate {
  name: string;
  siret?: string;
  vat_number?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zip_code?: string;
  country?: string;
  status?: "active" | "inactive";
}

const keys = {
  all: ["companies"] as const,
  list: () => ["companies", "list"] as const,
};

export function useCompanies() {
  return useQuery({
    queryKey: keys.list(),
    queryFn: async () => {
      const { data } = await api.get<Company[]>("/companies/");
      return data;
    },
    staleTime: 60_000,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CompanyCreate) => {
      const { data } = await api.post<Company>("/companies/", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateCompany(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CompanyCreate>) => {
      const { data } = await api.patch<Company>(`/companies/${id}`, payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}
