import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { C } from "@/lib/constants";
import type { UserProfile } from "@/lib/types";

// ── Role labels ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  proprio_solo:     "Propriétaire",
  agence:           "Agence",
  portail_proprio:  "Portail proprio",
  opener:           "Ouvreur",
  artisan:          "Artisan",
  expert:           "Expert",
  hunter:           "Hunter",
  locataire:        "Locataire",
  acheteur_premium: "Acheteur premium",
  super_admin:      "Super Admin",
};

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

// ── Menu row ──────────────────────────────────────────────────────────────────

function MenuRow({
  emoji,
  label,
  sublabel,
  onPress,
  danger,
}: {
  emoji:    string;
  label:    string;
  sublabel?: string;
  onPress:  () => void;
  danger?:  boolean;
}) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={styles.menuEmoji}>{emoji}</Text>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, danger && { color: C.red }]}>{label}</Text>
        {!!sublabel && <Text style={styles.menuSublabel}>{sublabel}</Text>}
      </View>
      {!danger && <Text style={styles.menuChevron}>›</Text>}
    </TouchableOpacity>
  );
}

// ── ProfilScreen ──────────────────────────────────────────────────────────────

export default function ProfilScreen() {
  const qc = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn:  () => api.get<UserProfile>("/users/me").then(r => r.data),
  });

  async function seDeconnecter() {
    Alert.alert(
      "Déconnexion",
      "Voulez-vous vraiment vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnexion",
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            await supabase.auth.signOut();
            qc.clear();
            router.replace("/(auth)/connexion");
          },
        },
      ],
    );
  }

  function initiales() {
    if (!profile) return "?";
    return ((profile.prenom?.[0] ?? "") + (profile.nom?.[0] ?? "")).toUpperCase() || "?";
  }

  function nomComplet() {
    if (!profile) return "";
    return [profile.prenom, profile.nom].filter(Boolean).join(" ");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header avatar */}
      <View style={styles.heroSection}>
        {isLoading ? (
          <ActivityIndicator color={C.orange} size="large" />
        ) : (
          <>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initiales()}</Text>
            </View>
            <Text style={styles.heroName}>{nomComplet() || "Mon profil"}</Text>
            {profile?.email && (
              <Text style={styles.heroEmail}>{profile.email}</Text>
            )}
            {profile?.role && (
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>
                  {ROLE_LABELS[profile.role] ?? profile.role}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Mon compte */}
      <SectionHeader label="Mon compte" />
      <View style={styles.card}>
        <MenuRow
          emoji="✏️"
          label="Modifier mon profil"
          sublabel="Nom, prénom, photo, téléphone"
          onPress={() => router.push("/(detail)/profil/modifier" as never)}
        />
        <View style={styles.divider} />
        <MenuRow
          emoji="🔒"
          label="Changer de mot de passe"
          onPress={() => router.push("/(detail)/profil/mot-de-passe" as never)}
        />
        <View style={styles.divider} />
        <MenuRow
          emoji="🔔"
          label="Notifications"
          sublabel="Gérer mes alertes"
          onPress={() => router.push("/(detail)/profil/notifications" as never)}
        />
      </View>

      {/* Abonnement */}
      <SectionHeader label="Abonnement" />
      <View style={styles.card}>
        <MenuRow
          emoji="💳"
          label="Mon abonnement"
          sublabel="Gérer et facturation"
          onPress={() => router.push("/(detail)/abonnement" as never)}
        />
      </View>

      {/* Aide */}
      <SectionHeader label="Aide & informations" />
      <View style={styles.card}>
        <MenuRow
          emoji="❓"
          label="Centre d'aide"
          onPress={() => router.push("/(detail)/aide" as never)}
        />
        <View style={styles.divider} />
        <MenuRow
          emoji="📄"
          label="Conditions d'utilisation"
          onPress={() => router.push("/(detail)/cgu" as never)}
        />
        <View style={styles.divider} />
        <MenuRow
          emoji="🛡️"
          label="Politique de confidentialité"
          onPress={() => router.push("/(detail)/confidentialite" as never)}
        />
      </View>

      {/* Déconnexion */}
      <View style={[styles.card, styles.cardDanger]}>
        <MenuRow
          emoji="🚪"
          label="Se déconnecter"
          onPress={seDeconnecter}
          danger
        />
      </View>

      {/* Version */}
      <Text style={styles.version}>Althy · Version 1.0.0</Text>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content:   { paddingBottom: 40 },

  heroSection: {
    alignItems:      "center",
    paddingTop:      60,
    paddingBottom:   28,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.orange,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
    shadowColor: C.orange, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  avatarText: { fontSize: 28, fontWeight: "800", color: "#fff" },

  heroName:  { fontSize: 20, fontWeight: "700", color: C.text, marginBottom: 4 },
  heroEmail: { fontSize: 13, color: C.text3, marginBottom: 10 },

  roleBadge: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 20, backgroundColor: C.orangeBg,
    borderWidth: 1, borderColor: C.orange,
  },
  roleText: { fontSize: 12, fontWeight: "700", color: C.orange },

  sectionHeader: {
    fontSize: 11, fontWeight: "700", color: C.text3,
    letterSpacing: 1, textTransform: "uppercase",
    marginHorizontal: 20, marginTop: 20, marginBottom: 6,
  },

  card: {
    marginHorizontal: 20,
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    overflow: "hidden",
  },
  cardDanger: {
    marginTop: 8, borderColor: C.red + "40",
  },

  menuRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  menuEmoji:    { fontSize: 20, width: 28, textAlign: "center" },
  menuContent:  { flex: 1 },
  menuLabel:    { fontSize: 14, fontWeight: "600", color: C.text },
  menuSublabel: { fontSize: 11, color: C.text3, marginTop: 1 },
  menuChevron:  { fontSize: 18, color: C.text3, fontWeight: "300" },

  divider: { height: 1, backgroundColor: C.border, marginLeft: 56 },

  version: {
    textAlign: "center", color: C.text3,
    fontSize: 11, marginTop: 24,
  },
});
