"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { AgencyDashboard, OwnerDashboard } from "../types";

export function useOwnerDashboard() {
  return useQuery({
    queryKey: ["dashboard", "owner"],
    queryFn: async () => {
      const { data } = await api.get<OwnerDashboard>("/dashboard/owner");
      return data;
    },
    staleTime: 60_000,
    retry: (count, err: unknown) => {
      const s = (err as { response?: { status?: number } })?.response?.status;
      if (s === 401 || s === 403) return false;
      return count < 2;
    },
  });
}

export function useAgencyDashboard() {
  return useQuery({
    queryKey: ["dashboard", "agency"],
    queryFn: async () => {
      const { data } = await api.get<AgencyDashboard>("/dashboard/agency");
      return data;
    },
    staleTime: 60_000,
    retry: (count, err: unknown) => {
      const s = (err as { response?: { status?: number } })?.response?.status;
      if (s === 401 || s === 403) return false;
      return count < 2;
    },
  });
}
