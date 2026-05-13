/**
 * API client typed pour `contracts` (Sprint 8 Lot C — workflow bail bailleur ↔ locataire).
 *
 * Endpoints :
 *   - GET  /api/v1/contracts/me                  → getMyContract (locataire)
 *   - GET  /api/v1/contracts/{id}                → getContract
 *   - GET  /api/v1/contracts                     → listContracts
 *   - POST /api/v1/contracts/{id}/countersign    → countersignContract (locataire)
 *
 * Le hook useContracts.ts existant couvre déjà les opérations bailleur
 * (list / get / create / update / sign / delete). Ce module ajoute les
 * surfaces propres au workflow locataire (Sprint 8).
 *
 * Doctrine §B.15 — Phase 1.0 = signature légère (IP + horodatage), pas Skribble.
 */

import { api } from "../api";
import type { Contract, PaginatedContracts } from "../types";

export async function getMyContract(): Promise<Contract | null> {
  const { data } = await api.get<Contract | null>("/contracts/me");
  return data;
}

export async function getContract(id: string): Promise<Contract> {
  const { data } = await api.get<Contract>(`/contracts/${id}`);
  return data;
}

export async function listContracts(params: Record<string, unknown> = {}): Promise<PaginatedContracts> {
  const { data } = await api.get<PaginatedContracts>("/contracts", { params });
  return data;
}

export async function countersignContract(id: string): Promise<Contract> {
  const { data } = await api.post<Contract>(`/contracts/${id}/countersign`);
  return data;
}
