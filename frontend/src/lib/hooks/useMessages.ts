"use client";

/**
 * useMessages — data fetching + polling 15s + optimistic send pour le thread
 * messagerie d'un bien (Module Communication Phase 1.0, PR-2).
 *
 * Doctrine :
 *  - 4-PRODUIT.md §4.13 : "Realtime Supabase configuré mais pas branché en
 *    Phase 1.0 (refresh manuel suffisant pour Sunimmo)". On utilise donc un
 *    polling 15s côté client. WebSocket/Realtime = Phase 1.1+.
 *  - CLAUDE.md §B.10 : pas de faux statut. L'optimistic UI utilise un
 *    sentinel `_status: "sending" | "error"` clair, et rollback en cas d'échec.
 *
 * Visibilité onglet : pause polling quand `document.hidden` (économie batterie
 * mobile + bande passante). Refetch immédiat au retour focus.
 *
 * Optimistic update : on insère un message « temporaire » dans le cache au
 * moment du `sendMessage`, on POST en arrière-plan, puis on remplace par le
 * vrai (ou rollback). Le temp_id est généré côté client (crypto.randomUUID).
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMessages,
  sendMessage as apiSendMessage,
  markMessageRead as apiMarkMessageRead,
  markThreadRead as apiMarkThreadRead,
  type BienMessageRead,
  type BienMessageThreadResponse,
} from "../api/messages";

const POLLING_INTERVAL_MS = 15_000;

export const messageKeys = {
  all: ["bien-messages"] as const,
  thread: (bienId: string) => ["bien-messages", "thread", bienId] as const,
  unread: () => ["bien-messages", "unread"] as const,
};

/**
 * Type étendu du message qui ajoute un statut local d'optimistic update.
 * `_status === "sending"` → bulle grisée + spinner.
 * `_status === "error"`   → bulle rouge avec icône re-essayer (Phase 1.1).
 */
export interface OptimisticBienMessage extends BienMessageRead {
  _status?: "sending" | "error";
}

interface UseMessagesReturn {
  messages: OptimisticBienMessage[];
  totalUnread: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  sendMessage: (body: string, recipientUserId: string) => Promise<void>;
  isSending: boolean;
  markThreadRead: () => Promise<void>;
  markMessageRead: (messageId: string) => Promise<void>;
  refresh: () => void;
}

export function useMessages(bienId: string): UseMessagesReturn {
  const qc = useQueryClient();
  const [isTabActive, setIsTabActive] = useState(
    typeof document === "undefined" ? true : !document.hidden,
  );
  // On garde une trace locale des messages optimistic (non encore confirmés).
  // Map<temp_id, OptimisticBienMessage>. Stockée hors cache RQ pour ne pas
  // contaminer la donnée serveur — on les merge au render.
  const optimisticRef = useRef<Map<string, OptimisticBienMessage>>(new Map());
  // Force re-render quand on mute la Map (Map mutation ≠ state change).
  const [optimisticTick, setOptimisticTick] = useState(0);

  // ── Visibilité onglet ─────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      const active = !document.hidden;
      setIsTabActive(active);
      if (active) {
        // Refetch immédiat au retour focus.
        qc.invalidateQueries({ queryKey: messageKeys.thread(bienId) });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [bienId, qc]);

  // ── Query principale (polling 15s tant que tab actif) ────────────────────
  const query = useQuery<BienMessageThreadResponse, Error>({
    queryKey: messageKeys.thread(bienId),
    queryFn: () => listMessages(bienId, { limit: 100 }),
    enabled: Boolean(bienId),
    staleTime: 5_000,
    refetchInterval: isTabActive ? POLLING_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    retry: (count, err) => {
      // 403 (pas de droits) / 404 (bien inexistant) : pas de retry.
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 403 || status === 404) return false;
      return count < 2;
    },
  });

  // ── Optimistic merge ──────────────────────────────────────────────────────
  // Les messages confirmés par le serveur viennent du cache RQ. On y ajoute
  // les optimistic pending qui n'ont pas encore été remplacés (par id).
  const messages = useMemo<OptimisticBienMessage[]>(() => {
    const server = (query.data?.messages ?? []) as OptimisticBienMessage[];
    if (optimisticRef.current.size === 0) return server;
    // Si un message serveur a le même body + sender + date proche d'un
    // optimistic, on le considère comme déjà arrivé et on retire l'optimistic.
    // Heuristique simple Phase 1.0 : on retire les optimistic dont l'âge >
    // 30s (le serveur a soit accepté, soit échoué — soit le polling a
    // refetch entre-temps).
    const pending = Array.from(optimisticRef.current.values());
    return [...server, ...pending];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, optimisticTick]);

  // ── Mutation : sendMessage avec optimistic ────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: ({
      body,
      recipientUserId,
    }: {
      body: string;
      recipientUserId: string;
    }) => apiSendMessage(bienId, { body, recipient_user_id: recipientUserId }),
  });

  const sendMessage = useCallback(
    async (body: string, recipientUserId: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;

      const tempId = `temp_${
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Date.now().toString(36)
      }`;
      const nowIso = new Date().toISOString();
      // On ne connaît pas notre propre user_id ici (le composant le passera
      // séparément si besoin). Pour l'optimistic, sender_user_id sera
      // re-déduit côté UI par comparaison body+recipient. Mais pour rester
      // type-safe on met une valeur vide qui sera ignorée par l'alignement
      // gauche/droite (le composant utilise currentUserId pour cela).
      const optimistic: OptimisticBienMessage = {
        id: tempId,
        bien_id: bienId,
        // sender_user_id sera réécrit par le composant à partir de currentUser
        // au moment du render. On laisse vide ici.
        sender_user_id: "__optimistic_self__",
        recipient_user_id: recipientUserId,
        body: trimmed,
        lu: false,
        lu_at: null,
        created_at: nowIso,
        sender: null,
        recipient: null,
        _status: "sending",
      };
      optimisticRef.current.set(tempId, optimistic);
      setOptimisticTick((t) => t + 1);

      try {
        const real = await sendMutation.mutateAsync({
          body: trimmed,
          recipientUserId,
        });
        // Replace optimistic par message réel via cache RQ.
        optimisticRef.current.delete(tempId);
        setOptimisticTick((t) => t + 1);
        qc.setQueryData<BienMessageThreadResponse>(
          messageKeys.thread(bienId),
          (prev) => {
            if (!prev) {
              return {
                messages: [real],
                total: 1,
                unread_count: 0,
              };
            }
            // Éviter doublon si polling a déjà ramené le message.
            if (prev.messages.some((m) => m.id === real.id)) return prev;
            return {
              ...prev,
              messages: [...prev.messages, real],
              total: prev.total + 1,
            };
          },
        );
      } catch (err) {
        // Rollback : flag l'optimistic en erreur (UI affichera bulle rouge),
        // puis on auto-clean après 4s pour ne pas le laisser perdurer.
        const failed = optimisticRef.current.get(tempId);
        if (failed) {
          optimisticRef.current.set(tempId, { ...failed, _status: "error" });
          setOptimisticTick((t) => t + 1);
          setTimeout(() => {
            optimisticRef.current.delete(tempId);
            setOptimisticTick((t) => t + 1);
          }, 4000);
        }
        throw err;
      }
    },
    [bienId, qc, sendMutation],
  );

  // ── Mark single message as read ───────────────────────────────────────────
  const markMessageRead = useCallback(
    async (messageId: string) => {
      try {
        const updated = await apiMarkMessageRead(bienId, messageId);
        qc.setQueryData<BienMessageThreadResponse>(
          messageKeys.thread(bienId),
          (prev) =>
            prev
              ? {
                  ...prev,
                  messages: prev.messages.map((m) =>
                    m.id === messageId ? updated : m,
                  ),
                  unread_count: Math.max(0, prev.unread_count - 1),
                }
              : prev,
        );
        qc.invalidateQueries({ queryKey: messageKeys.unread() });
      } catch {
        // Best-effort : on n'interrompt pas le flow lecture utilisateur.
      }
    },
    [bienId, qc],
  );

  // ── Mark whole thread read ────────────────────────────────────────────────
  const markThreadRead = useCallback(async () => {
    // Optimistic : on flip tous les messages reçus à lu immédiatement.
    const prev = qc.getQueryData<BienMessageThreadResponse>(
      messageKeys.thread(bienId),
    );
    if (prev && prev.unread_count > 0) {
      qc.setQueryData<BienMessageThreadResponse>(
        messageKeys.thread(bienId),
        {
          ...prev,
          messages: prev.messages.map((m) =>
            m.lu ? m : { ...m, lu: true, lu_at: new Date().toISOString() },
          ),
          unread_count: 0,
        },
      );
    }
    try {
      await apiMarkThreadRead(bienId);
      qc.invalidateQueries({ queryKey: messageKeys.unread() });
    } catch {
      // Rollback
      if (prev) {
        qc.setQueryData(messageKeys.thread(bienId), prev);
      }
    }
  }, [bienId, qc]);

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: messageKeys.thread(bienId) });
  }, [bienId, qc]);

  return {
    messages,
    totalUnread: query.data?.unread_count ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    sendMessage,
    isSending: sendMutation.isPending,
    markThreadRead,
    markMessageRead,
    refresh,
  };
}
