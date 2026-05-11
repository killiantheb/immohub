/**
 * API client typed pour `bien_messages` (Module Communication Phase 1.0).
 *
 * Mirror des endpoints livrés PR-1 (2026-05-12) :
 *   - POST   /api/v1/biens/{bien_id}/messages                       → sendMessage
 *   - GET    /api/v1/biens/{bien_id}/messages                       → listMessages
 *   - PATCH  /api/v1/biens/{bien_id}/messages/{message_id}/lu       → markMessageRead
 *   - PATCH  /api/v1/biens/{bien_id}/messages/marquer-lus           → markThreadRead
 *   - GET    /api/v1/bien_messages/non-lus                          → getUnreadCount
 *
 * Types alignés sur `backend/app/schemas/bien_message.py`. Pas de pièces
 * jointes Phase 1.0 (cf 4-PRODUIT.md §4.13). Texte brut uniquement.
 */

import { api } from "../api";

// ── Types (mirror backend Pydantic) ──────────────────────────────────────────

export interface BienMessageUserMini {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export interface BienMessageRead {
  id: string;
  bien_id: string;
  sender_user_id: string;
  recipient_user_id: string;
  body: string;
  lu: boolean;
  lu_at: string | null;
  created_at: string;
  sender: BienMessageUserMini | null;
  recipient: BienMessageUserMini | null;
}

export interface BienMessageCreate {
  recipient_user_id: string;
  body: string;
}

export interface BienMessageThreadResponse {
  messages: BienMessageRead[];
  total: number;
  unread_count: number;
}

export interface MarkThreadReadResponse {
  marked_count: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface ListMessagesParams {
  skip?: number;
  limit?: number;
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function listMessages(
  bienId: string,
  params: ListMessagesParams = {},
): Promise<BienMessageThreadResponse> {
  const { data } = await api.get<BienMessageThreadResponse>(
    `/biens/${bienId}/messages`,
    { params },
  );
  return data;
}

export async function sendMessage(
  bienId: string,
  payload: BienMessageCreate,
): Promise<BienMessageRead> {
  const { data } = await api.post<BienMessageRead>(
    `/biens/${bienId}/messages`,
    payload,
  );
  return data;
}

export async function markMessageRead(
  bienId: string,
  messageId: string,
): Promise<BienMessageRead> {
  const { data } = await api.patch<BienMessageRead>(
    `/biens/${bienId}/messages/${messageId}/lu`,
  );
  return data;
}

export async function markThreadRead(
  bienId: string,
): Promise<MarkThreadReadResponse> {
  const { data } = await api.patch<MarkThreadReadResponse>(
    `/biens/${bienId}/messages/marquer-lus`,
  );
  return data;
}

export async function getUnreadCount(): Promise<UnreadCountResponse> {
  const { data } = await api.get<UnreadCountResponse>(
    `/bien_messages/non-lus`,
  );
  return data;
}
