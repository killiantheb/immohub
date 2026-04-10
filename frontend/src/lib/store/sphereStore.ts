import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SphereState = "idle" | "listening" | "thinking" | "speaking";

export type ActionType =
  | 'document_action'
  | 'messagerie_action'
  | 'whatsapp_action'
  | 'paiement_action'
  | 'ocr_action'
  | 'intervention_action'
  | 'agenda_action'
  | 'validation_action'
  | 'notation_action'
  | 'integration_action';

export type Urgence = 'haute' | 'normale' | 'info';

export interface SphereAction {
  id: string;
  // New structured fields
  type?: ActionType;
  titre?: string;
  description?: string;
  urgence?: Urgence;
  cta_principal?: string;
  cta_secondaire?: string;
  payload?: Record<string, unknown>;
  // Notation fields
  acteur_id?: string;
  acteur_nom?: string;
  acteur_role?: string;
  // Legacy (kept for compat)
  label?: string;
  icon?: string;
  path?: string;
  requires_validation?: boolean;
}

export interface SphereMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: SphereAction[];
  intent?: string;
  createdAt: number;
}

interface SphereStore {
  // UI state
  state: SphereState;
  setState: (s: SphereState) => void;

  // Conversation
  messages: SphereMessage[];
  addMessage: (msg: SphereMessage) => void;
  updateLastAssistant: (content: string) => void;
  setLastActions: (intent: string, actions: SphereAction[]) => void;
  clearMessages: () => void;

  // Streaming
  streamingText: string;
  setStreamingText: (t: string) => void;
  appendStreamingText: (chunk: string) => void;
  clearStreamingText: () => void;

  // Rate limiting — 30/day standard (stored locally)
  dailyCount: number;
  dailyDate: string;  // YYYY-MM-DD
  incrementDaily: () => void;
  canSend: () => boolean;

  // Session
  sessionId: string | null;
  setSessionId: (id: string) => void;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const useSphereStore = create<SphereStore>()(
  persist(
    (set, get) => ({
      state: "idle",
      setState: (s) => set({ state: s }),

      messages: [],
      addMessage: (msg) =>
        set((prev) => ({ messages: [...prev.messages.slice(-49), msg] })),
      updateLastAssistant: (content) =>
        set((prev) => {
          const msgs = [...prev.messages];
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "assistant") {
              msgs[i] = { ...msgs[i], content };
              break;
            }
          }
          return { messages: msgs };
        }),
      setLastActions: (intent, actions) =>
        set((prev) => {
          const msgs = [...prev.messages];
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "assistant") {
              msgs[i] = { ...msgs[i], intent, actions };
              break;
            }
          }
          return { messages: msgs };
        }),
      clearMessages: () => set({ messages: [] }),

      streamingText: "",
      setStreamingText: (t) => set({ streamingText: t }),
      appendStreamingText: (chunk) =>
        set((prev) => ({ streamingText: prev.streamingText + chunk })),
      clearStreamingText: () => set({ streamingText: "" }),

      // Rate limit: 30/day
      dailyCount: 0,
      dailyDate: todayStr(),
      incrementDaily: () =>
        set((prev) => {
          const today = todayStr();
          if (prev.dailyDate !== today) {
            return { dailyCount: 1, dailyDate: today };
          }
          return { dailyCount: prev.dailyCount + 1 };
        }),
      canSend: () => {
        const { dailyCount, dailyDate } = get();
        if (dailyDate !== todayStr()) return true;
        return dailyCount < 30;
      },

      sessionId: null,
      setSessionId: (id) => set({ sessionId: id }),
    }),
    {
      name: "althy-sphere",
      partialize: (s) => ({
        messages: s.messages,
        dailyCount: s.dailyCount,
        dailyDate: s.dailyDate,
        sessionId: s.sessionId,
      }),
    }
  )
);
