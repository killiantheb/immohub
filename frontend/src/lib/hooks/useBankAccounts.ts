"use client";

/**
 * Hooks React Query — comptes bancaires utilisateur (PR-A11.A.6.c).
 *
 * Endpoints (préfixe `/api/v1/users/me`) :
 *   - GET    /bank-accounts               — liste user authentifié
 *   - POST   /bank-accounts               — création (201)
 *   - PATCH  /bank-accounts/{account_id}  — update partiel
 *   - DELETE /bank-accounts/{account_id}  — soft delete (204)
 *
 * Logique métier `est_principal` unique (enforced double DB + service
 * backend A11.A.6.b) : quand un compte passe à est_principal=true, tous
 * les autres comptes du user basculent à false. Côté optimistic, on
 * réplique cette cascade dans la cache pour cohérence visuelle immédiate.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export type BankAccountUsage =
  | "regie"
  | "cautions"
  | "charges"
  | "travaux"
  | "general";

export interface BankAccount {
  id: string;
  user_id: string;
  usage: BankAccountUsage | string;
  iban: string;
  bic?: string | null;
  titulaire: string;
  banque_nom?: string | null;
  banque_pays: string;
  est_principal: boolean;
  created_at: string;
  updated_at: string;
}

export interface BankAccountCreate {
  usage: BankAccountUsage | string;
  iban: string;
  bic?: string | null;
  titulaire: string;
  banque_nom?: string | null;
  banque_pays?: string;
  est_principal?: boolean;
}

export type BankAccountUpdate = Partial<BankAccountCreate>;

export const bankAccountKeys = {
  all: ["bank-accounts"] as const,
  list: () => ["bank-accounts", "me"] as const,
};

export function useBankAccounts() {
  return useQuery({
    queryKey: bankAccountKeys.list(),
    queryFn: async () => {
      const { data } = await api.get<BankAccount[]>(
        "/users/me/bank-accounts",
      );
      return data;
    },
    staleTime: 30_000,
  });
}

/** Bascule en mémoire les autres comptes à est_principal=false si la
 * mutation passe est_principal=true sur la cible. */
function cascadePrincipal(
  list: BankAccount[],
  targetId: string | null,
): BankAccount[] {
  return list.map((a) =>
    a.id === targetId ? a : { ...a, est_principal: false },
  );
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BankAccountCreate) => {
      const { data } = await api.post<BankAccount>(
        "/users/me/bank-accounts",
        payload,
      );
      return data;
    },
    onSuccess: (created) => {
      qc.setQueryData<BankAccount[]>(bankAccountKeys.list(), (prev) => {
        const next = [...(prev ?? []), created];
        return created.est_principal ? cascadePrincipal(next, created.id) : next;
      });
      qc.invalidateQueries({ queryKey: bankAccountKeys.list() });
    },
  });
}

export function useUpdateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      accountId,
      patch,
    }: {
      accountId: string;
      patch: BankAccountUpdate;
    }) => {
      const { data } = await api.patch<BankAccount>(
        `/users/me/bank-accounts/${accountId}`,
        patch,
      );
      return data;
    },
    onMutate: async ({ accountId, patch }) => {
      await qc.cancelQueries({ queryKey: bankAccountKeys.list() });
      const prev = qc.getQueryData<BankAccount[]>(bankAccountKeys.list());
      if (prev) {
        let next = prev.map((a) =>
          a.id === accountId ? { ...a, ...patch } : a,
        );
        if (patch.est_principal === true) {
          next = cascadePrincipal(next, accountId);
        }
        qc.setQueryData<BankAccount[]>(bankAccountKeys.list(), next);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(bankAccountKeys.list(), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bankAccountKeys.list() });
    },
  });
}

export function useDeleteBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      await api.delete(`/users/me/bank-accounts/${accountId}`);
      return accountId;
    },
    onMutate: async (accountId) => {
      await qc.cancelQueries({ queryKey: bankAccountKeys.list() });
      const prev = qc.getQueryData<BankAccount[]>(bankAccountKeys.list());
      if (prev) {
        qc.setQueryData<BankAccount[]>(
          bankAccountKeys.list(),
          prev.filter((a) => a.id !== accountId),
        );
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(bankAccountKeys.list(), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: bankAccountKeys.list() });
    },
  });
}
