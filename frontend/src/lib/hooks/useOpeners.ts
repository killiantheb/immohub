"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  Mission,
  MissionPriceEstimate,
  MissionStatus,
  MissionType,
  OpenerProfile,
  OpenerWithDistance,
  PaginatedMissions,
} from "../types";

// ── Query key factories ────────────────────────────────────────────────────────

export const openerKeys = {
  all: ["openers"] as const,
  list: (filters: Record<string, unknown>) => ["openers", "list", filters] as const,
  me: () => ["openers", "me"] as const,
  detail: (id: string) => ["openers", id] as const,
  priceEstimate: (type: MissionType, dist: number) => ["openers", "price", type, dist] as const,
};

export const missionKeys = {
  all: ["missions"] as const,
  my: (filters: Record<string, unknown>) => ["missions", "my", filters] as const,
  requested: (filters: Record<string, unknown>) => ["missions", "requested", filters] as const,
  detail: (id: string) => ["missions", id] as const,
};

// ── Opener profile ─────────────────────────────────────────────────────────────

export function useMyOpenerProfile() {
  return useQuery({
    queryKey: openerKeys.me(),
    queryFn: async () => {
      const { data } = await api.get<OpenerProfile>("/openers/me");
      return data;
    },
    retry: false,
  });
}

export function useUpsertOpenerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<OpenerProfile>) => {
      const { data } = await api.put<OpenerProfile>("/openers/me", payload);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(openerKeys.me(), updated);
    },
  });
}

export function usePatchOpenerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<OpenerProfile>) => {
      const { data } = await api.patch<OpenerProfile>("/openers/me", payload);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(openerKeys.me(), updated);
    },
  });
}

// ── Discovery ──────────────────────────────────────────────────────────────────

interface OpenerSearchParams {
  lat: number;
  lng: number;
  radius_km?: number;
  mission_type?: MissionType;
  limit?: number;
}

export function useNearbyOpeners(params: OpenerSearchParams) {
  return useQuery({
    queryKey: openerKeys.list(params as unknown as Record<string, unknown>),
    queryFn: async () => {
      const { data } = await api.get<OpenerWithDistance[]>("/openers", { params });
      return data;
    },
    enabled: Boolean(params.lat && params.lng),
    staleTime: 60_000,
  });
}

export function usePriceEstimate(type: MissionType, distance_km: number) {
  return useQuery({
    queryKey: openerKeys.priceEstimate(type, distance_km),
    queryFn: async () => {
      const { data } = await api.get<MissionPriceEstimate>("/openers/price-estimate", {
        params: { mission_type: type, distance_km },
      });
      return data;
    },
    enabled: distance_km >= 0,
    staleTime: 5 * 60_000,
  });
}

// ── Missions ───────────────────────────────────────────────────────────────────

interface MissionFilters {
  status?: MissionStatus;
  page?: number;
  size?: number;
}

export function useMyMissions(filters: MissionFilters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
  );
  return useQuery({
    queryKey: missionKeys.my(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedMissions>("/missions/my", { params });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useRequestedMissions(filters: MissionFilters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== ""),
  );
  return useQuery({
    queryKey: missionKeys.requested(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedMissions>("/missions/requested", { params });
      return data;
    },
    staleTime: 30_000,
  });
}

export function useMission(id: string) {
  return useQuery({
    queryKey: missionKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<Mission>(`/missions/${id}`);
      return data;
    },
    enabled: Boolean(id),
  });
}

export function useCreateMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      property_id: string;
      type: MissionType;
      scheduled_at: string;
      notes?: string;
      property_lat?: number;
      property_lng?: number;
      opener_id?: string;
    }) => {
      const { data } = await api.post<Mission>("/missions", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: missionKeys.all });
    },
  });
}

export function useAcceptMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.put<Mission>(`/missions/${id}/accept`);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(missionKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: missionKeys.all });
    },
  });
}

export function useCompleteMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      report_text,
      photos_urls,
      report_url,
    }: {
      id: string;
      report_text?: string;
      photos_urls?: string[];
      report_url?: string;
    }) => {
      const { data } = await api.put<Mission>(`/missions/${id}/complete`, {
        report_text,
        photos_urls: photos_urls ?? [],
        report_url,
      });
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(missionKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: missionKeys.all });
    },
  });
}

export function useRateMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      rating,
      comment,
    }: {
      id: string;
      rating: number;
      comment?: string;
    }) => {
      const { data } = await api.put<Mission>(`/missions/${id}/rate`, { rating, comment });
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(missionKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: missionKeys.all });
    },
  });
}

export function useCancelMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await api.put<Mission>(`/missions/${id}/cancel`, null, {
        params: reason ? { reason } : undefined,
      });
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(missionKeys.detail(updated.id), updated);
      qc.invalidateQueries({ queryKey: missionKeys.all });
    },
  });
}
