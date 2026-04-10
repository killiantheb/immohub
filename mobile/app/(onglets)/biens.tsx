import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { C } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Bien {
  id:         string;
  adresse:    string;
  ville:      string;
  canton:     string;
  type:       "appartement" | "maison" | "studio" | "villa" | "commercial" | "autre";
  surface_m2: number | null;
  nb_pieces:  number | null;
  statut:     "libre" | "loue" | "a_vendre" | "vendu" | "renovation";
  loyer_net:  number | null;
  photo_url?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeLabel(t: Bien["type"]) {
  return {
    appartement: "Appartement",
    maison:      "Maison",
    studio:      "Studio",
    villa:       "Villa",
    commercial:  "Commercial",
    autre:       "Autre",
  }[t] ?? t;
}

function typeEmoji(t: Bien["type"]) {
  return {
    appartement: "🏢",
    maison:      "🏠",
    studio:      "🛋️",
    villa:       "🏡",
    commercial:  "🏪",
    autre:       "🏗️",
  }[t] ?? "🏠";
}

function statutStyle(s: Bien["statut"]) {
  return {
    libre:      { bg: C.greenBg,  fg: C.green,  label: "Libre"      },
    loue:       { bg: C.blueBg,   fg: C.blue,   label: "Loué"       },
    a_vendre:   { bg: C.amberBg,  fg: C.amber,  label: "À vendre"   },
    vendu:      { bg: C.surface2, fg: C.text3,  label: "Vendu"      },
    renovation: { bg: C.redBg,    fg: C.red,    label: "Rénovation" },
  }[s] ?? { bg: C.surface2, fg: C.text3, label: s };
}

// ── BienCard ──────────────────────────────────────────────────────────────────

function BienCard({ item }: { item: Bien }) {
  const s = statutStyle(item.statut);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push(`/(detail)/biens/${item.id}` as never)}
    >
      {/* Photo placeholder */}
      <View style={styles.cardPhoto}>
        <Text style={styles.cardPhotoEmoji}>{typeEmoji(item.type)}</Text>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardAdresse} numberOfLines={1}>{item.adresse}</Text>
          <View style={[styles.statutChip, { backgroundColor: s.bg }]}>
            <Text style={[styles.statutText, { color: s.fg }]}>{s.label}</Text>
          </View>
        </View>

        <Text style={styles.cardVille}>{item.ville}, {item.canton}</Text>

        <View style={styles.cardMetas}>
          <Text style={styles.cardMeta}>{typeLabel(item.type)}</Text>
          {item.surface_m2 != null && (
            <Text style={styles.cardMeta}>· {item.surface_m2} m²</Text>
          )}
          {item.nb_pieces != null && (
            <Text style={styles.cardMeta}>· {item.nb_pieces} p.</Text>
          )}
        </View>

        {item.loyer_net != null && (
          <Text style={styles.cardLoyer}>
            CHF {item.loyer_net.toLocaleString("fr-CH")} / mois
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── BiensScreen ───────────────────────────────────────────────────────────────

type Filtre = "tous" | "libre" | "loue" | "a_vendre";

export default function BiensScreen() {
  const qc = useQueryClient();
  const [filtre, setFiltre] = useState<Filtre>("tous");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["biens", filtre],
    queryFn:  () =>
      api.get<Bien[]>(`/biens/${filtre !== "tous" ? `?statut=${filtre}` : ""}`).then(r => r.data),
  });

  const biens = data ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mes biens</Text>
        <Text style={styles.headerSub}>{biens.length} bien{biens.length > 1 ? "s" : ""}</Text>
      </View>

      {/* Filtres */}
      <FlatList
        horizontal
        data={[
          { key: "tous",     label: "Tous" },
          { key: "libre",    label: "Libres" },
          { key: "loue",     label: "Loués" },
          { key: "a_vendre", label: "À vendre" },
        ] as { key: Filtre; label: string }[]}
        keyExtractor={i => i.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtresRow}
        renderItem={({ item: f }) => (
          <TouchableOpacity
            onPress={() => setFiltre(f.key)}
            style={[styles.filtreChip, filtre === f.key && styles.filtreChipActive]}
          >
            <Text style={[styles.filtreText, filtre === f.key && styles.filtreTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Liste */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.orange} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Impossible de charger les biens.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : biens.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🏠</Text>
          <Text style={styles.emptyTitle}>Aucun bien trouvé</Text>
          <Text style={styles.emptySub}>
            Ajoutez votre premier bien depuis la Sphère IA.
          </Text>
        </View>
      ) : (
        <FlatList
          data={biens}
          keyExtractor={b => b.id}
          renderItem={({ item }) => <BienCard item={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["biens"] })}
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

  filtresRow:      { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  filtreChip:      { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },
  filtreChipActive:{ backgroundColor: C.orangeBg, borderColor: C.orange },
  filtreText:      { fontSize: 12, fontWeight: "600", color: C.text3 },
  filtreTextActive:{ color: C.orange },

  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },

  card: {
    backgroundColor: C.surface, borderRadius: 14,
    shadowColor: "#1A1612", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    overflow: "hidden",
  },
  cardPhoto: {
    height: 100, backgroundColor: C.surface2,
    alignItems: "center", justifyContent: "center",
  },
  cardPhotoEmoji: { fontSize: 40 },

  cardContent:  { padding: 14, gap: 4 },
  cardTopRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardAdresse:  { flex: 1, fontSize: 14, fontWeight: "700", color: C.text },

  statutChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statutText: { fontSize: 10, fontWeight: "700" },

  cardVille: { fontSize: 12, color: C.text3 },
  cardMetas: { flexDirection: "row", gap: 4, marginTop: 2 },
  cardMeta:  { fontSize: 12, color: C.text2 },
  cardLoyer: { fontSize: 14, fontWeight: "700", color: C.orange, marginTop: 4 },

  center:     { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText:  { color: C.red, fontSize: 14, textAlign: "center", marginBottom: 12 },
  retryBtn:   { backgroundColor: C.orange, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText:  { color: "#fff", fontWeight: "700" },

  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: C.text3, textAlign: "center", lineHeight: 20 },
});
