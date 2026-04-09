"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlthySphereCore } from "@/components/sphere/AlthySphereCore";
import { SphereInput } from "@/components/sphere/SphereInput";
import { SphereStream } from "@/components/sphere/SphereStream";
import { ActionCard, ActionConfirmDialog } from "@/components/sphere/ActionCard";
import { SuggestionChips } from "@/components/sphere/SuggestionChips";
import { useSphereStore, type SphereAction } from "@/lib/store/sphereStore";
import { baseURL } from "@/lib/api";
import { createClient } from "@/lib/supabase";

export default function SpherePage() {
  const router = useRouter();
  const store = useSphereStore();

  // Pending confirmation for requires_validation actions
  const [pendingAction, setPendingAction] = useState<SphereAction | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const remaining = store.canSend()
    ? 30 - (store.dailyDate === new Date().toISOString().slice(0, 10) ? store.dailyCount : 0)
    : 0;

  const isStreaming = store.state === "thinking" || store.state === "speaking";
  const lastAssistant = [...store.messages].reverse().find((m) => m.role === "assistant");
  const lastUser = [...store.messages].reverse().find((m) => m.role === "user");
  const showSuggestions = store.messages.length === 0;

  const sendMessage = useCallback(
    async (text: string) => {
      if (!store.canSend() || isStreaming) return;

      // Rate limit
      store.incrementDaily();

      // Add user message
      const userMsg = { id: crypto.randomUUID(), role: "user" as const, content: text, createdAt: Date.now() };
      store.addMessage(userMsg);

      // Prepare assistant placeholder
      const assistantMsg = { id: crypto.randomUUID(), role: "assistant" as const, content: "", createdAt: Date.now() };
      store.addMessage(assistantMsg);
      store.clearStreamingText();
      store.setState("thinking");

      // Get JWT
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const body = JSON.stringify({
        message: text,
        context: {
          session_id: store.sessionId ?? crypto.randomUUID(),
          page: "sphere",
        },
      });

      abortRef.current = new AbortController();

      try {
        const resp = await fetch(`${baseURL}/ai/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body,
          signal: abortRef.current.signal,
        });

        if (!resp.ok || !resp.body) {
          store.updateLastAssistant("Erreur de connexion. Veuillez réessayer.");
          store.setState("idle");
          return;
        }

        store.setState("speaking");
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;

            try {
              const event = JSON.parse(raw) as {
                type?: string;
                text?: string;
                intent?: string;
                actions?: SphereAction[];
                error?: string;
              };

              if (event.type === "intent" && event.actions) {
                store.setLastActions(event.intent ?? "", event.actions);
              } else if (event.type === "text" || event.text) {
                const chunk = (event.text ?? "").replace(/\\n/g, "\n");
                fullText += chunk;
                store.appendStreamingText(chunk);
                store.updateLastAssistant(fullText);
              } else if (event.type === "error" || event.error) {
                store.updateLastAssistant(event.error ?? "Erreur IA.");
              }
            } catch {
              // malformed SSE line — ignore
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          store.updateLastAssistant("Connexion interrompue. Réessayez.");
        }
      } finally {
        store.clearStreamingText();
        store.setState("idle");
      }
    },
    [store, isStreaming]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--althy-bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "0 16px 32px",
        position: "relative",
      }}
    >
      {/* ── Top bar ── */}
      <div style={{
        width: "100%",
        maxWidth: 680,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px 0 0",
      }}>
        <span style={{
          fontFamily: "var(--font-serif)",
          fontSize: 20,
          fontWeight: 300,
          color: "var(--althy-text)",
          letterSpacing: "-0.01em",
        }}>
          Althy
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          {store.messages.length > 0 && (
            <button
              onClick={() => store.clearMessages()}
              style={{
                fontSize: 12,
                color: "var(--althy-text-3)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              Nouvelle conversation
            </button>
          )}
          <button
            onClick={() => router.push("/app")}
            style={{
              fontSize: 12,
              color: "var(--althy-text-3)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            Tableau de bord →
          </button>
        </div>
      </div>

      {/* ── Sphere ── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: 40,
        marginBottom: showSuggestions ? 32 : 24,
      }}>
        <AlthySphereCore state={store.state} size={180} />
      </div>

      {/* ── Response area ── */}
      <div style={{ width: "100%", maxWidth: 640, flex: 1, marginBottom: 16 }}>
        {store.messages.length === 0 ? (
          /* Welcome state */
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <p style={{
              fontFamily: "var(--font-serif)",
              fontSize: 22,
              fontWeight: 300,
              color: "var(--althy-text)",
              marginBottom: 6,
              letterSpacing: "-0.01em",
            }}>
              Bonjour, que puis-je faire pour vous ?
            </p>
            <p style={{ fontSize: 13, color: "var(--althy-text-3)" }}>
              Posez votre question ou parlez directement à Althy.
            </p>
          </div>
        ) : (
          /* Conversation */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SphereStream
              text={lastAssistant?.content ?? ""}
              isStreaming={isStreaming}
              userMessage={lastUser?.content}
            />

            {/* Action card — show on last assistant message */}
            {lastAssistant?.actions && lastAssistant.actions.length > 0 && !isStreaming && (
              <ActionCard
                actions={lastAssistant.actions}
                onConfirm={(action) => setPendingAction(action)}
                onDismiss={() => {
                  if (lastAssistant) {
                    store.setLastActions("", []);
                  }
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Suggestion chips (first visit) ── */}
      {showSuggestions && (
        <div style={{ width: "100%", maxWidth: 640, marginBottom: 20 }}>
          <SuggestionChips onSelect={sendMessage} />
        </div>
      )}

      {/* ── Input ── */}
      <div style={{ width: "100%", maxWidth: 640, position: "sticky", bottom: 0 }}>
        <SphereInput
          onSend={sendMessage}
          disabled={isStreaming}
          remainingToday={remaining}
        />
        <p style={{
          textAlign: "center",
          fontSize: 11,
          color: "var(--althy-text-3)",
          marginTop: 8,
        }}>
          Althy suggère, vous validez. Vérifiez tout document légal avec un professionnel.
        </p>
      </div>

      {/* ── Confirmation dialog ── */}
      {pendingAction && (
        <ActionConfirmDialog
          action={pendingAction}
          onConfirm={() => setPendingAction(null)}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
