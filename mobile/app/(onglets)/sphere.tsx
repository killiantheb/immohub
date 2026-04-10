"use client";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { api } from "@/lib/api";
import { C } from "@/lib/constants";
import type { SphereBriefing, SphereAction, OcrResult } from "@/lib/types";
import { AlthySphereNative } from "@/components/AlthySphereNative";
import { CarteAction } from "@/components/CarteAction";
import { ModalAction } from "@/components/ModalAction";
import { supabase } from "@/lib/supabase";

// ── Message bubble ────────────────────────────────────────────────────────────

interface Message { id: string; role: "user" | "assistant"; content: string; createdAt: number; }

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
      <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
        {msg.content}
      </Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SphereScreen() {
  const queryClient = useQueryClient();
  const scrollRef   = useRef<ScrollView>(null);

  const [prenom,         setPrenom]         = useState("");
  const [inputText,      setInputText]      = useState("");
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [streaming,      setStreaming]       = useState(false);
  const [selectedAction, setSelectedAction] = useState<SphereAction | null>(null);
  const [scanning,       setScanning]       = useState(false);

  // ── Load briefing ──────────────────────────────────────────────────────────
  const { data: briefing, isLoading, refetch, isRefetching } = useQuery<SphereBriefing>({
    queryKey: ["sphere-briefing"],
    queryFn:  () => api.get<SphereBriefing>("/sphere/briefing").then(r => r.data),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // ── Load user prenom ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const p = user?.user_metadata?.first_name ?? user?.email?.split("@")[0] ?? "";
      setPrenom(p);
    });
  }, []);

  // ── Push notifications — schedule for urgent actions ──────────────────────
  useEffect(() => {
    if (!briefing?.actions) return;
    const urgentes = briefing.actions.filter(a => a.urgence === "haute");
    urgentes.forEach(action => {
      Notifications.scheduleNotificationAsync({
        content: {
          title: "⚠️ Action urgente — Althy",
          body:  action.titre ?? action.description ?? "Une action requiert votre attention.",
          data:  { action_id: action.id },
        },
        trigger: null, // immediate
      }).catch(() => {});
    });
  }, [briefing]);

  // ── Scroll to bottom when messages change ─────────────────────────────────
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ── Send message to Sphere ─────────────────────────────────────────────────
  async function envoyerMessage(text?: string) {
    const msg = (text ?? inputText).trim();
    if (!msg || streaming) return;

    setInputText("");
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg, createdAt: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);

    try {
      // Use SSE streaming endpoint
      const baseURL   = (process.env.EXPO_PUBLIC_API_URL ?? "https://api.althy.ch/api/v1")
        .replace(/\/$/, "");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";

      const response = await fetch(`${baseURL}/sphere/stream`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ message: msg }),
      });

      const reader  = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      const assistantId    = (Date.now() + 1).toString();

      setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "…", createdAt: Date.now() }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.token) {
                assistantContent += parsed.token;
                setMessages(prev =>
                  prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m),
                );
              }
            } catch { /* partial JSON */ }
          }
        }
      }

      // Refresh briefing after interaction (new actions may have been created)
      queryClient.invalidateQueries({ queryKey: ["sphere-briefing"] });
    } catch {
      setMessages(prev => [...prev, {
        id:        Date.now().toString(),
        role:      "assistant",
        content:   "Je n'arrive pas à me connecter au serveur. Vérifiez votre connexion et réessayez.",
        createdAt: Date.now(),
      }]);
    } finally {
      setStreaming(false);
    }
  }

  // ── Scan a bill / document via camera ─────────────────────────────────────
  async function scanner() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission requise", "Althy a besoin d'accéder à la caméra pour scanner vos factures.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.85,
      base64:     false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setScanning(true);
    const asset = result.assets[0];

    try {
      const formData = new FormData();
      formData.append("fichier", {
        uri:  asset.uri,
        name: "facture.jpg",
        type: "image/jpeg",
      } as unknown as Blob);

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const baseURL = (process.env.EXPO_PUBLIC_API_URL ?? "https://api.althy.ch/api/v1").replace(/\/$/, "");

      const res = await fetch(`${baseURL}/factures/analyser`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });

      const ocr: OcrResult = await res.json();
      const montantStr   = ocr.montant != null ? ` — CHF ${ocr.montant}` : "";
      const fournisseur  = ocr.fournisseur ?? "Fournisseur inconnu";

      // Create a Sphere action for the scanned bill
      await api.post("/sphere/actions", {
        type_action:  "ocr_action",
        urgence:      "normal",
        titre:        `Facture ${fournisseur}${montantStr}`,
        description:  ocr.description ?? "Facture scannée via Althy",
        payload:      { ...ocr, path: "/app/comptabilite" },
        libelle_cta:  "Affecter au bien",
        libelle_cta2: "Voir la comptabilité",
      });

      setMessages(prev => [...prev, {
        id:        Date.now().toString(),
        role:      "assistant",
        content:   `📸 Facture analysée — ${fournisseur}${montantStr}. Elle est dans votre Sphère pour affectation.`,
        createdAt: Date.now(),
      }]);
      queryClient.invalidateQueries({ queryKey: ["sphere-briefing"] });
    } catch {
      setMessages(prev => [...prev, {
        id:        Date.now().toString(),
        role:      "assistant",
        content:   "📸 Impossible d'analyser cette facture. Réessayez ou utilisez la section Comptabilité.",
        createdAt: Date.now(),
      }]);
    } finally {
      setScanning(false);
    }
  }

  // ── Dismiss action ────────────────────────────────────────────────────────
  async function ignorer(id: string) {
    try {
      await api.post(`/sphere/action/${id}/ignorer`);
      queryClient.setQueryData<SphereBriefing>(["sphere-briefing"], prev =>
        prev ? { ...prev, actions: prev.actions.filter(a => a.id !== id) } : prev,
      );
    } catch { /* ignore */ }
  }

  const actions = briefing?.actions ?? [];
  const greet   = prenom ? `Bonjour ${prenom},` : "Bonjour,";
  const hasChat = messages.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* ── Scrollable content ──────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.orange}
          />
        }
      >
        {/* Hero header */}
        <View style={styles.hero}>
          <AlthySphereNative size={72} pulsing={streaming || scanning} />
          <View style={styles.heroText}>
            <Text style={styles.greet}>{greet}</Text>
            <Text style={styles.subtitle}>
              {briefing?.resume ?? "Que puis-je faire pour vous ?"}
            </Text>
          </View>
        </View>

        {/* Pending actions count */}
        {(briefing?.pending_count ?? 0) > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>
              {briefing!.pending_count} action{briefing!.pending_count > 1 ? "s" : ""} en attente
            </Text>
          </View>
        )}

        {/* Briefing actions */}
        {isLoading ? (
          <ActivityIndicator color={C.orange} style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.actionsSection}>
            {actions.map(action => (
              <CarteAction
                key={action.id}
                action={action}
                onPress={setSelectedAction}
                onIgnorer={ignorer}
              />
            ))}
            {actions.length === 0 && !hasChat && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Tout est à jour ✓{"\n"}Posez-moi une question ci-dessous.</Text>
              </View>
            )}
          </View>
        )}

        {/* Chat messages */}
        {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}

        {/* Quick suggestions (shown when no messages) */}
        {!hasChat && (
          <View style={styles.suggestions}>
            {[
              "Quel est mon loyer du mois ?",
              "Appelle un plombier",
              "Résumé de la semaine",
              "Scanner une facture",
            ].map(s => (
              <TouchableOpacity
                key={s}
                style={styles.chip}
                onPress={() => s === "Scanner une facture" ? scanner() : envoyerMessage(s)}
              >
                <Text style={styles.chipText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Input bar ───────────────────────────────────────────────── */}
      <View style={styles.inputBar}>
        {/* Camera button */}
        <TouchableOpacity
          style={[styles.iconBtn, scanning && { backgroundColor: C.orangeBg }]}
          onPress={scanner}
          disabled={scanning}
        >
          {scanning
            ? <ActivityIndicator size="small" color={C.orange} />
            : <Text style={styles.iconBtnText}>📷</Text>
          }
        </TouchableOpacity>

        {/* Text input */}
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={streaming ? "Althy réfléchit…" : "Posez votre question à Althy…"}
          placeholderTextColor={C.text3}
          multiline
          maxLength={1000}
          editable={!streaming}
          returnKeyType="send"
          onSubmitEditing={() => envoyerMessage()}
        />

        {/* Send button */}
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: inputText.trim() && !streaming ? C.orange : C.surface2 },
          ]}
          onPress={() => envoyerMessage()}
          disabled={!inputText.trim() || streaming}
        >
          {streaming
            ? <ActivityIndicator size="small" color={C.orange} />
            : <Text style={[styles.sendBtnText, { color: inputText.trim() ? "#fff" : C.text3 }]}>↑</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Action modal ─────────────────────────────────────────────── */}
      <ModalAction
        action={selectedAction}
        visible={!!selectedAction}
        onClose={() => setSelectedAction(null)}
        onDone={() => {
          setSelectedAction(null);
          queryClient.invalidateQueries({ queryKey: ["sphere-briefing"] });
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  scroll:        { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 8 },

  hero: {
    flexDirection:  "row",
    alignItems:     "center",
    gap:            16,
    marginBottom:   20,
    paddingVertical: 8,
  },
  heroText: { flex: 1 },
  greet: {
    fontSize:    22,
    fontWeight:  "800",
    color:       C.text,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize:   13,
    color:      C.text3,
    lineHeight: 19,
  },

  pendingBadge: {
    backgroundColor: C.orangeBg,
    borderRadius:    20,
    paddingHorizontal: 12,
    paddingVertical:   5,
    alignSelf:       "flex-start",
    marginBottom:    14,
  },
  pendingText: { fontSize: 12, color: C.orange, fontWeight: "700" },

  actionsSection: { marginBottom: 8 },

  emptyState: {
    backgroundColor: C.surface,
    borderRadius:    14,
    padding:         20,
    alignItems:      "center",
    marginTop:       8,
  },
  emptyText: { color: C.text3, fontSize: 13, textAlign: "center", lineHeight: 20 },

  bubble: {
    maxWidth:     "82%",
    borderRadius: 16,
    padding:      12,
    marginBottom: 8,
  },
  bubbleUser: {
    backgroundColor: C.orange,
    alignSelf:       "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: C.surface,
    alignSelf:       "flex-start",
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextUser:      { color: "#fff" },
  bubbleTextAssistant: { color: C.text },

  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, marginBottom: 8 },
  chip: {
    backgroundColor: C.surface,
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    20,
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  chipText: { fontSize: 12, color: C.text2, fontWeight: "600" },

  inputBar: {
    flexDirection:   "row",
    alignItems:      "flex-end",
    gap:             8,
    paddingHorizontal: 12,
    paddingVertical:   10,
    backgroundColor: C.surface,
    borderTopWidth:  1,
    borderTopColor:  C.border,
  },
  iconBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: C.surface2,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  iconBtnText: { fontSize: 18 },

  textInput: {
    flex:            1,
    minHeight:       40,
    maxHeight:       120,
    backgroundColor: C.bg,
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    20,
    paddingHorizontal: 14,
    paddingVertical:   10,
    fontSize:        14,
    color:           C.text,
  },
  sendBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  sendBtnText: { fontSize: 20, fontWeight: "700", marginTop: -2 },
});
