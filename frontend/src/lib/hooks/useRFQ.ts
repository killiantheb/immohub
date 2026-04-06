"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  AIQualifyResponse,
  MarketplaceCompany,
  PaginatedRFQs,
  RFQ,
  RFQCreate,
  RFQQuote,
  RFQStatus,
} from "../types";

const keys = {
  all: ["rfqs"] as const,
  list: (status?: string) => ["rfqs", "list", status ?? "all"] as const,
  detail: (id: string) => ["rfqs", "detail", id] as const,
  companies: (type?: string) => ["rfqs", "marketplace", type ?? "all"] as const,
  dashboard: () => ["rfqs", "company-dashboard"] as const,
};

// ── Marketplace companies ──────────────────────────────────────────────────────

export function useMarketplaceCompanies(type?: string, minRating?: number) {
  return useQuery({
    queryKey: keys.companies(type),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (type) params.set("company_type", type);
      if (minRating) params.set("min_rating", String(minRating));
      const { data } = await api.get<MarketplaceCompany[]>(
        `/rfqs/marketplace/companies?${params}`
      );
      return data;
    },
    staleTime: 60_000,
  });
}

// ── AI qualification ───────────────────────────────────────────────────────────

export function useQualifyRFQ() {
  return useMutation({
    mutationFn: async (description: string) => {
      const { data } = await api.post<AIQualifyResponse>("/rfqs/qualify", {
        description,
      });
      return data;
    },
  });
}

// ── RFQ CRUD ──────────────────────────────────────────────────────────────────

export function useRFQs(status?: RFQStatus | "") {
  return useQuery({
    queryKey: keys.list(status),
    queryFn: async () => {
      const params = status ? `?rfq_status=${status}` : "";
      const { data } = await api.get<PaginatedRFQs>(`/rfqs/${params}`);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useRFQ(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<RFQ>(`/rfqs/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateRFQ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RFQCreate) => {
      const { data } = await api.post<RFQ>("/rfqs/", payload);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

// ── Quote lifecycle ────────────────────────────────────────────────────────────

export function useSubmitQuote(rfqId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      amount: number;
      description: string;
      delay_days?: number;
      warranty_months?: number;
      notes?: string;
    }) => {
      const { data } = await api.post<RFQQuote>(`/rfqs/${rfqId}/quotes`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(rfqId) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useAcceptQuote(rfqId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data } = await api.put<RFQ>(`/rfqs/${rfqId}/accept/${quoteId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(rfqId) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useCompleteRFQ(rfqId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.put<RFQ>(`/rfqs/${rfqId}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(rfqId) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useRateRFQ(rfqId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { rating: number; comment?: string }) => {
      const { data } = await api.post<RFQ>(`/rfqs/${rfqId}/rate`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(rfqId) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

// ── Company dashboard ─────────────────────────────────────────────────────────

export function useCompanyDashboardRFQs(page = 1) {
  return useQuery({
    queryKey: [...keys.dashboard(), page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedRFQs>(
        `/rfqs/company/dashboard?page=${page}`
      );
      return data;
    },
    staleTime: 30_000,
  });
}
