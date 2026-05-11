"use client";

/**
 * ConversationBien — UI chat 1:1 bailleur ↔ locataire (Module Communication
 * Phase 1.0, PR-2 bailleur).
 *
 * Doctrine :
 *  - 4-PRODUIT.md §4.13 : canal 1:1 lié à un bail, texte brut uniquement,
 *    pas de pièces jointes Phase 1.0. Notif email = PR-4 (Resend).
 *  - CLAUDE.md §B.4 : palette Bleu de Prusse + Or, 0 orange. Bulles bailleur
 *    bg `C.prussian` / bulles locataire bg `C.surface2`.
 *  - CLAUDE.md §B.10 : pas de faux statut. Erreur API → bulle rouge claire,
 *    empty state honnête, loading state explicite.
 *
 * Architecture UI :
 *
 *   ┌─────────────────────────────────────────┐
 *   │ Header sticky : avatar + nom locataire  │
 *   ├─────────────────────────────────────────┤
 *   │ Zone scrollable : bulles                │
 *   │   - bulles sender = right + prussian    │
 *   │   - bulles recipient = left + surface2  │
 *   │   - timestamps + icône lu ✓ / ✓✓        │
 *   ├─────────────────────────────────────────┤
 *   │ Input sticky : textarea + bouton Envoyer│
 *   └─────────────────────────────────────────┘
 *
 * Marquage lu : au montage, si messages non-lus pour current_user →
 * markThreadRead() (optimistic UI).
 *
 * Auto-scroll : au bottom au montage + après envoi + après réception via
 * polling — sauf si l'utilisateur a remonté manuellement (détection scroll
 * position à >100px du bottom).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageSquare, Send, UserPlus } from "lucide-react";
import Link from "next/link";
import { useBien, useLocataireActuel } from "@/lib/hooks/useBiens";
import { useMessages, type OptimisticBienMessage } from "@/lib/hooks/useMessages";
import { useUser } from "@/lib/auth";
import { C } from "@/lib/design-tokens";
import { Card, Empty, Skel, btnP } from "@/app/app/(dashboard)/biens/[id]/_shared";

interface Props {
  bienId: string;
}

// ── Helpers locaux (relative time + initiales) ────────────────────────────────

/** Affichage relatif court fr-CH. < 1 min "à l'instant", < 1h "il y a Xmin",
 *  < 24h "il y a Xh", sinon date courte "23 oct. 14:32". */
function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 0) return "à l'instant";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `il y a ${hr} h`;
  return new Date(iso).toLocaleDateString("fr-CH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialsFromUser(
  user: { first_name: string | null; last_name: string | null } | null,
  fallback = "?",
): string {
  if (!user) return fallback;
  const first = (user.first_name ?? "").trim();
  const last = (user.last_name ?? "").trim();
  const letters = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return letters || fallback;
}

function fullName(
  user: { first_name: string | null; last_name: string | null } | null,
  fallback = "Locataire",
): string {
  if (!user) return fallback;
  const composed = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return composed || fallback;
}

// ── Sub-component : MessageBubble ─────────────────────────────────────────────

function MessageBubble({
  msg,
  isFromMe,
}: {
  msg: OptimisticBienMessage;
  isFromMe: boolean;
}) {
  const sending = msg._status === "sending";
  const failed = msg._status === "error";

  const bubbleBg = isFromMe
    ? failed
      ? C.redBg
      : C.prussian
    : C.surface2;
  const bubbleColor = isFromMe ? (failed ? C.red : "#fff") : C.text;
  const borderRadiusCorner = isFromMe
    ? "16px 16px 4px 16px"
    : "16px 16px 16px 4px";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isFromMe ? "flex-end" : "flex-start",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          maxWidth: "75%",
          background: bubbleBg,
          color: bubbleColor,
          padding: "9px 14px",
          borderRadius: borderRadiusCorner,
          fontSize: 14,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          opacity: sending ? 0.7 : 1,
          border: failed ? `1px solid ${C.red}` : "none",
        }}
      >
        {msg.body}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 3,
          fontSize: 11,
          color: failed ? C.red : C.text3,
          paddingLeft: isFromMe ? 0 : 4,
          paddingRight: isFromMe ? 4 : 0,
        }}
      >
        {sending ? (
          <>
            <Loader2 size={10} className="animate-spin" />
            <span>envoi…</span>
          </>
        ) : failed ? (
          <span>échec d&apos;envoi</span>
        ) : (
          <>
            <span>{fmtRelative(msg.created_at)}</span>
            {isFromMe && (
              <span
                aria-label={msg.lu ? "Lu" : "Envoyé"}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: msg.lu ? C.gold : C.text3,
                  letterSpacing: -1,
                }}
              >
                {msg.lu ? "✓✓" : "✓"}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ConversationBien({ bienId }: Props) {
  const { data: profile } = useUser();
  const { data: bien, isLoading: loadingBien, error: bienError } = useBien(bienId);
  const { data: locataire, isLoading: loadingLoc } = useLocataireActuel(bienId);
  const {
    messages,
    isLoading: loadingMsgs,
    isError: msgsError,
    error,
    sendMessage,
    isSending,
    markThreadRead,
  } = useMessages(bienId);

  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Détection « user a remonté manuellement ». Si à >100px du bottom, on
  // n'auto-scroll plus jusqu'à ce qu'il redescende.
  const userScrolledUpRef = useRef(false);

  const currentUserId = profile?.id ?? null;
  const recipientUserId = locataire?.user_id ?? null;

  // ── Marquage lu automatique au montage ───────────────────────────────────
  // On déclenche markThreadRead() une seule fois quand les messages sont
  // chargés ET qu'il y a au moins un non-lu pour current_user. Pas de
  // dépendance sur le count pour ne pas re-déclencher en boucle après le flip.
  const hasMarkedReadRef = useRef(false);
  useEffect(() => {
    if (hasMarkedReadRef.current) return;
    if (loadingMsgs || !currentUserId) return;
    const hasUnreadForMe = messages.some(
      (m) => m.recipient_user_id === currentUserId && !m.lu,
    );
    if (hasUnreadForMe) {
      hasMarkedReadRef.current = true;
      void markThreadRead();
    }
  }, [messages, loadingMsgs, currentUserId, markThreadRead]);

  // ── Auto-scroll vers le bas ──────────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    if (loadingMsgs) return;
    // Au mount des messages, scroll immédiat (auto). Aux suivants (polling
    // ou envoi), on respecte userScrolledUp.
    if (!userScrolledUpRef.current) {
      scrollToBottom(hasMarkedReadRef.current ? "smooth" : "auto");
    }
  }, [messages.length, loadingMsgs, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUpRef.current = distanceFromBottom > 100;
  }, []);

  // ── Auto-resize textarea ─────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxPx = 24 * 5 + 16; // ~5 lignes
    ta.style.height = `${Math.min(ta.scrollHeight, maxPx)}px`;
  }, [draft]);

  // ── Send handler ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!recipientUserId) return;
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;
    setSendError(null);
    try {
      await sendMessage(trimmed, recipientUserId);
      setDraft("");
      userScrolledUpRef.current = false; // après envoi, on revient en bas
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 403) {
        setSendError(
          "Vous n'avez pas l'autorisation d'envoyer un message dans ce thread.",
        );
      } else if (status === 400) {
        setSendError("Message invalide.");
      } else {
        setSendError(
          "Échec d'envoi. Vérifiez votre connexion et réessayez.",
        );
      }
    }
  }, [draft, recipientUserId, isSending, sendMessage, scrollToBottom]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  // ── Memoized bubbles (avec correction sender_user_id optimistic) ─────────
  const renderedMessages = useMemo<OptimisticBienMessage[]>(() => {
    if (!currentUserId) return messages;
    // Pour les bulles optimistic qui n'ont pas encore un sender_user_id réel,
    // on les considère comme « from me ».
    return messages.map((m) =>
      m.sender_user_id === "__optimistic_self__"
        ? { ...m, sender_user_id: currentUserId }
        : m,
    );
  }, [messages, currentUserId]);

  // ── Render branches ───────────────────────────────────────────────────────

  // 1) Loading bien
  if (loadingBien) {
    return (
      <Card>
        <Skel h={20} w="40%" />
        <div style={{ height: 12 }} />
        <Skel h={120} />
      </Card>
    );
  }

  // 2) Bien introuvable ou pas de droits (§B.10 : honnête)
  if (bienError || !bien) {
    const status = (bienError as { response?: { status?: number } })?.response
      ?.status;
    return (
      <Card>
        <Empty
          icon={MessageSquare}
          title={
            status === 403
              ? "Accès refusé"
              : status === 404
                ? "Bien introuvable"
                : "Impossible de charger la conversation"
          }
          sub={
            status === 403
              ? "Vous n'avez pas accès à la messagerie de ce bien."
              : status === 404
                ? "Ce bien n'existe plus ou a été archivé."
                : "Une erreur réseau est survenue. Réessayez dans quelques instants."
          }
        />
      </Card>
    );
  }

  // 3) Loading locataire
  if (loadingLoc) {
    return (
      <Card>
        <Skel h={20} w="40%" />
        <div style={{ height: 12 }} />
        <Skel h={120} />
      </Card>
    );
  }

  // 4) Pas de locataire actif ou locataire pas encore lié à un user
  if (!locataire || !recipientUserId) {
    return (
      <Card>
        <Empty
          icon={UserPlus}
          title="Aucun locataire actif"
          sub={
            locataire && !locataire.user_id
              ? "Le locataire enregistré n'a pas encore accepté son invitation. Une fois inscrit, la conversation s'ouvrira automatiquement."
              : "Invitez un locataire pour démarrer une conversation."
          }
          action={
            <Link
              href={`/app/biens/${bienId}/locataire`}
              style={{
                ...btnP,
                textDecoration: "none",
              }}
            >
              <UserPlus size={14} />
              Gérer le locataire
            </Link>
          }
        />
      </Card>
    );
  }

  // 5) Thread chargement initial
  if (loadingMsgs && messages.length === 0) {
    return (
      <Card>
        <Skel h={20} w="40%" />
        <div style={{ height: 12 }} />
        <Skel h={300} />
      </Card>
    );
  }

  // 6) Thread error
  if (msgsError) {
    const status = (error as { response?: { status?: number } })?.response
      ?.status;
    return (
      <Card>
        <Empty
          icon={MessageSquare}
          title="Impossible de charger les messages"
          sub={
            status === 403
              ? "Accès refusé à ce thread."
              : "Erreur réseau. Le polling reprendra automatiquement quand la connexion sera rétablie."
          }
        />
      </Card>
    );
  }

  // ── Render principal : header + zone scroll + input ──────────────────────

  const locataireName = fullName(
    locataire.user_id
      ? // On préfère l'identité réelle si on en a une (via un message déjà
        // reçu d'eux). Sinon fallback "Locataire #xxxx".
        renderedMessages.find((m) => m.sender_user_id === recipientUserId)
          ?.sender ?? null
      : null,
    `Locataire #${locataire.id.slice(0, 6)}`,
  );
  const locataireInitials = initialsFromUser(
    renderedMessages.find((m) => m.sender_user_id === recipientUserId)
      ?.sender ?? null,
    "L",
  );

  return (
    <Card style={{ padding: 0, display: "flex", flexDirection: "column", height: "calc(100vh - 280px)", minHeight: 480 }}>
      {/* Header sticky */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
          flexShrink: 0,
        }}
      >
        <div
          aria-hidden
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: C.prussianBg,
            color: C.prussian,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {locataireInitials}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {locataireName}
          </p>
          <p style={{ fontSize: 11, color: C.text3 }}>
            Locataire actif · {bien.adresse}
          </p>
        </div>
      </div>

      {/* Zone scrollable bulles */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "18px 18px 8px",
          background: C.bg,
        }}
      >
        {renderedMessages.length === 0 ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Empty
              icon={MessageSquare}
              title="Démarrez la conversation"
              sub={`Aucun message échangé avec ${locataireName} pour ce bien. Écrivez le premier message ci-dessous.`}
            />
          </div>
        ) : (
          renderedMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isFromMe={msg.sender_user_id === currentUserId}
            />
          ))
        )}
      </div>

      {/* Bandeau erreur d'envoi */}
      {sendError && (
        <div
          role="alert"
          style={{
            padding: "8px 18px",
            background: C.redBg,
            color: C.red,
            fontSize: 12,
            borderTop: `1px solid ${C.border}`,
          }}
        >
          {sendError}
        </div>
      )}

      {/* Input sticky */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          padding: "12px 14px",
          borderTop: `1px solid ${C.border}`,
          background: C.surface,
          flexShrink: 0,
        }}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrire un message…"
          rows={1}
          aria-label="Écrire un message"
          style={{
            flex: 1,
            resize: "none",
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 14,
            lineHeight: 1.4,
            fontFamily: "inherit",
            color: C.text,
            background: C.surface2,
            outline: "none",
            minHeight: 40,
            maxHeight: 140,
          }}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!draft.trim() || isSending}
          aria-label="Envoyer le message"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: 12,
            border: "none",
            background:
              !draft.trim() || isSending ? C.border : C.prussian,
            color: "#fff",
            cursor:
              !draft.trim() || isSending ? "not-allowed" : "pointer",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
        >
          {isSending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>
    </Card>
  );
}
