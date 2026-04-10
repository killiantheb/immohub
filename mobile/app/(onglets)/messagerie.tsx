import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { C } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conversation {
  id:            string;
  avec_prenom:   string;
  avec_nom?:     string;
  avec_role?:    string;
  dernier_msg:   string;
  dernier_at:    string;   // ISO
  non_lus:       number;
}

interface Message {
  id:         string;
  contenu:    string;
  envoye_par: string;    // user id
  created_at: string;    // ISO
  lu:         boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "À l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h  < 24)   return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

function initiales(prenom: string, nom?: string) {
  return (prenom[0] + (nom?.[0] ?? "")).toUpperCase();
}

// ── ConversationRow ───────────────────────────────────────────────────────────

function ConversationRow({
  item,
  selected,
  onPress,
}: {
  item:     Conversation;
  selected: boolean;
  onPress:  () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.convRow, selected && styles.convRowSelected]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {/* Avatar */}
      <View style={[styles.avatar, selected && styles.avatarSelected]}>
        <Text style={styles.avatarText}>{initiales(item.avec_prenom, item.avec_nom)}</Text>
      </View>

      {/* Info */}
      <View style={styles.convInfo}>
        <View style={styles.convTopRow}>
          <Text style={[styles.convNom, item.non_lus > 0 && styles.convNomBold]} numberOfLines={1}>
            {item.avec_prenom} {item.avec_nom ?? ""}
          </Text>
          <Text style={styles.convTime}>{timeAgo(item.dernier_at)}</Text>
        </View>
        <Text style={[styles.convPreview, item.non_lus > 0 && styles.convPreviewBold]} numberOfLines={1}>
          {item.dernier_msg}
        </Text>
      </View>

      {/* Badge */}
      {item.non_lus > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.non_lus > 99 ? "99+" : item.non_lus}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── ChatView ──────────────────────────────────────────────────────────────────

function ChatView({
  convId,
  meId,
  onBack,
}: {
  convId: string;
  meId:   string | null;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [texte, setTexte] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<ScrollView>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey:        ["messages", convId],
    queryFn:         () => api.get<Message[]>(`/messagerie/${convId}/messages`).then(r => r.data),
    refetchInterval: 5000,
  });

  useEffect(() => {
    // Mark as read
    api.post(`/messagerie/${convId}/lire`).catch(() => null);
    qc.invalidateQueries({ queryKey: ["messagerie"] });
  }, [convId]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length]);

  async function envoyer() {
    const txt = texte.trim();
    if (!txt || sending) return;
    setSending(true);
    setTexte("");
    try {
      await api.post(`/messagerie/${convId}/messages`, { contenu: txt });
      qc.invalidateQueries({ queryKey: ["messages", convId] });
      qc.invalidateQueries({ queryKey: ["messagerie"] });
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Chat header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Retour</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.orange} />
        </View>
      ) : (
        <ScrollView
          ref={listRef}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(m => {
            const isMine = m.envoye_par === meId;
            return (
              <View
                key={m.id}
                style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}
              >
                <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                  {m.contenu}
                </Text>
                <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                  {new Date(m.created_at).toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatInput}
          value={texte}
          onChangeText={setTexte}
          placeholder="Message…"
          placeholderTextColor={C.text3}
          multiline
          maxLength={2000}
          returnKeyType="default"
        />
        <TouchableOpacity
          onPress={envoyer}
          disabled={!texte.trim() || sending}
          style={[styles.sendBtn, (!texte.trim() || sending) && { opacity: 0.4 }]}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.sendBtnText}>→</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── MessagerieScreen ──────────────────────────────────────────────────────────

export default function MessagerieScreen() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);

  // Fetch current user id once
  useEffect(() => {
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
    });
  }, []);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey:        ["messagerie"],
    queryFn:         () => api.get<Conversation[]>("/messagerie/").then(r => r.data),
    refetchInterval: 15000,
  });

  const conversations = data ?? [];

  if (selected) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === "ios" ? 50 : 24 }}>
        <ChatView
          convId={selected}
          meId={meId}
          onBack={() => setSelected(null)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        {conversations.length > 0 && (
          <Text style={styles.headerSub}>
            {conversations.reduce((s, c) => s + c.non_lus, 0)} non lu{conversations.reduce((s, c) => s + c.non_lus, 0) > 1 ? "s" : ""}
          </Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.orange} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Impossible de charger les messages.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>✉️</Text>
          <Text style={styles.emptyTitle}>Aucun message</Text>
          <Text style={styles.emptySub}>Vos conversations apparaîtront ici.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              selected={selected === item.id}
              onPress={() => setSelected(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["messagerie"] })}
              tintColor={C.orange}
            />
          }
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header:      { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: "700", color: C.text },
  headerSub:   { fontSize: 13, color: C.text3, marginTop: 2 },

  convRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: C.surface,
  },
  convRowSelected: { backgroundColor: C.orangeBg },

  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.surface2,
    alignItems: "center", justifyContent: "center",
    marginRight: 12,
  },
  avatarSelected: { backgroundColor: C.orange },
  avatarText:     { fontSize: 15, fontWeight: "700", color: C.text2 },

  convInfo:    { flex: 1 },
  convTopRow:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  convNom:     { fontSize: 14, fontWeight: "600", color: C.text, flex: 1 },
  convNomBold: { fontWeight: "800" },
  convTime:    { fontSize: 11, color: C.text3 },
  convPreview: { fontSize: 12, color: C.text3, lineHeight: 16 },
  convPreviewBold: { fontWeight: "700", color: C.text2 },

  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: C.orange,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4, marginLeft: 8,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  separator: { height: 1, backgroundColor: C.border, marginLeft: 76 },

  center:     { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText:  { color: C.red, fontSize: 14, textAlign: "center", marginBottom: 12 },
  retryBtn:   { backgroundColor: C.orange, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText:  { color: "#fff", fontWeight: "700" },

  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: C.text3, textAlign: "center", lineHeight: 20 },

  // Chat
  chatHeader: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  backBtn:     { alignSelf: "flex-start" },
  backBtnText: { color: C.orange, fontSize: 14, fontWeight: "700" },

  chatList: { padding: 16, gap: 8 },

  bubble: {
    maxWidth: "78%", borderRadius: 14, padding: 10,
    backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border,
    alignSelf: "flex-start",
  },
  bubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: C.orange,
    borderColor: C.orange,
  },
  bubbleText:     { fontSize: 14, color: C.text, lineHeight: 20 },
  bubbleTextMine: { color: "#fff" },
  bubbleTime:     { fontSize: 10, color: C.text3, marginTop: 4, textAlign: "right" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.7)" },

  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.surface, gap: 8,
  },
  chatInput: {
    flex: 1, maxHeight: 100,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 14, color: C.text,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.orange,
    alignItems: "center", justifyContent: "center",
  },
  sendBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
