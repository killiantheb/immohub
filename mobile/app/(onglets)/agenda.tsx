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
import { api } from "@/lib/api";
import { C } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RdvItem {
  id:          string;
  titre:       string;
  date_heure:  string;           // ISO
  duree_min:   number;
  adresse?:    string;
  avec?:       string;
  type:        "visite" | "etat_lieux" | "rdv" | "autre";
  statut:      "confirme" | "en_attente" | "annule";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const JOURS  = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MOIS   = ["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sep", "oct", "nov", "déc"];

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    jour:   JOURS[d.getDay()],
    num:    d.getDate().toString(),
    mois:   MOIS[d.getMonth()],
    heure:  d.toLocaleTimeString("fr-CH", { hour: "2-digit", minute: "2-digit" }),
  };
}

function typeLabel(type: RdvItem["type"]) {
  return { visite: "Visite", etat_lieux: "État des lieux", rdv: "Rendez-vous", autre: "Autre" }[type] ?? "RDV";
}

function typeColor(type: RdvItem["type"]) {
  return {
    visite:      C.orange,
    etat_lieux:  C.blue,
    rdv:         C.green,
    autre:       C.text3,
  }[type] ?? C.text3;
}

function statutBadge(s: RdvItem["statut"]) {
  if (s === "confirme")    return { label: "Confirmé",    bg: C.greenBg,  fg: C.green };
  if (s === "en_attente")  return { label: "En attente",  bg: C.amberBg,  fg: C.amber };
  return                          { label: "Annulé",      bg: C.redBg,    fg: C.red   };
}

// ── RdvCard ───────────────────────────────────────────────────────────────────

function RdvCard({ item }: { item: RdvItem }) {
  const { jour, num, mois, heure } = formatDate(item.date_heure);
  const badge = statutBadge(item.statut);
  const color = typeColor(item.type);

  return (
    <View style={styles.card}>
      {/* Date column */}
      <View style={[styles.dateCol, { borderRightColor: color }]}>
        <Text style={[styles.dateJour, { color }]}>{jour}</Text>
        <Text style={[styles.dateNum,  { color }]}>{num}</Text>
        <Text style={[styles.dateMois, { color }]}>{mois}</Text>
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <View style={styles.cardRow}>
          <Text style={styles.cardTitre} numberOfLines={1}>{item.titre}</Text>
          <View style={[styles.statutBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statutText, { color: badge.fg }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={styles.cardHeure}>🕐 {heure} · {item.duree_min} min</Text>

        {!!item.avec && (
          <Text style={styles.cardMeta} numberOfLines={1}>👤 {item.avec}</Text>
        )}
        {!!item.adresse && (
          <Text style={styles.cardMeta} numberOfLines={1}>📍 {item.adresse}</Text>
        )}

        <View style={[styles.typeChip, { backgroundColor: color + "20" }]}>
          <Text style={[styles.typeText, { color }]}>{typeLabel(item.type)}</Text>
        </View>
      </View>
    </View>
  );
}

// ── AgendaScreen ──────────────────────────────────────────────────────────────

type Filter = "a_venir" | "passes";

export default function AgendaScreen() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("a_venir");

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["agenda", filter],
    queryFn:  () =>
      api.get<RdvItem[]>(`/agenda/?statut=${filter}`).then(r => r.data),
  });

  const rdvs = data ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Agenda</Text>
        <Text style={styles.headerSub}>
          {rdvs.length} rendez-vous
        </Text>
      </View>

      {/* Filter toggle */}
      <View style={styles.filterRow}>
        {(["a_venir", "passes"] as Filter[]).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === "a_venir" ? "À venir" : "Passés"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.orange} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Impossible de charger l'agenda.</Text>
          <TouchableOpacity onPress={() => refetch()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : rdvs.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>Aucun rendez-vous</Text>
          <Text style={styles.emptySub}>
            {filter === "a_venir"
              ? "Votre agenda est libre pour le moment."
              : "Aucun rendez-vous passé à afficher."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={rdvs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <RdvCard item={item} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["agenda"] })}
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

  filterRow: { flexDirection: "row", marginHorizontal: 20, marginBottom: 16, gap: 8 },
  filterBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border,
    alignItems: "center",
  },
  filterBtnActive: { backgroundColor: C.orangeBg, borderColor: C.orange },
  filterText:       { fontSize: 13, fontWeight: "600", color: C.text3 },
  filterTextActive: { color: C.orange },

  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 12 },

  card: {
    flexDirection: "row",
    backgroundColor: C.surface, borderRadius: 14, overflow: "hidden",
    shadowColor: "#1A1612", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  dateCol: {
    width: 56, alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRightWidth: 2,
  },
  dateJour:  { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  dateNum:   { fontSize: 22, fontWeight: "800", lineHeight: 28 },
  dateMois:  { fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },

  cardContent: { flex: 1, padding: 12, gap: 4 },
  cardRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitre:   { flex: 1, fontSize: 14, fontWeight: "700", color: C.text },

  statutBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statutText:  { fontSize: 10, fontWeight: "700" },

  cardHeure: { fontSize: 12, color: C.text3 },
  cardMeta:  { fontSize: 11, color: C.text3 },

  typeChip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  typeText: { fontSize: 10, fontWeight: "700" },

  center:     { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText:  { color: C.red, fontSize: 14, textAlign: "center", marginBottom: 12 },
  retryBtn:   { backgroundColor: C.orange, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryText:  { color: "#fff", fontWeight: "700" },

  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: C.text, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: C.text3, textAlign: "center", lineHeight: 20 },
});
