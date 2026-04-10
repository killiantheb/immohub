import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/constants";

const ROLES = [
  { value: "proprio_solo",    label: "Propriétaire" },
  { value: "agence",          label: "Agence" },
  { value: "artisan",         label: "Artisan" },
  { value: "opener",          label: "Ouvreur" },
  { value: "locataire",       label: "Locataire" },
  { value: "hunter",          label: "Hunter" },
];

export default function InscriptionScreen() {
  const [prenom,   setPrenom]   = useState("");
  const [nom,      setNom]      = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState("proprio_solo");
  const [loading,  setLoading]  = useState(false);

  async function sInscrire() {
    if (!prenom.trim() || !email.trim() || password.length < 8) {
      Alert.alert("Champs manquants", "Remplissez tous les champs et choisissez un mot de passe de 8 caractères minimum.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email:    email.trim().toLowerCase(),
        password,
        options: {
          data: { first_name: prenom.trim(), last_name: nom.trim(), role },
        },
      });
      if (error) {
        Alert.alert("Erreur d'inscription", error.message);
      } else {
        Alert.alert(
          "Compte créé !",
          "Vérifiez votre email puis connectez-vous.",
          [{ text: "OK", onPress: () => router.replace("/(auth)/connexion") }],
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>PRÉNOM *</Text>
              <TextInput style={styles.input} value={prenom} onChangeText={setPrenom} placeholder="Marie" placeholderTextColor={C.text3} autoCapitalize="words" />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>NOM</Text>
              <TextInput style={styles.input} value={nom} onChangeText={setNom} placeholder="Dupont" placeholderTextColor={C.text3} autoCapitalize="words" />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL *</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="vous@agence.ch" placeholderTextColor={C.text3} keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>MOT DE PASSE * (8 min.)</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={C.text3} secureTextEntry />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>VOTRE PROFIL</Text>
            <View style={styles.rolesGrid}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => setRole(r.value)}
                  style={[styles.roleChip, role === r.value && styles.roleChipActive]}
                >
                  <Text style={[styles.roleChipText, role === r.value && styles.roleChipTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, { opacity: loading ? 0.7 : 1 }]}
            onPress={sInscrire}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Créer mon compte</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnLink} onPress={() => router.back()}>
            <Text style={styles.btnLinkText}>Déjà un compte ? <Text style={{ color: C.orange, fontWeight: "700" }}>Se connecter</Text></Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, padding: 20 },
  card: {
    backgroundColor: C.surface, borderRadius: 20, padding: 22,
    shadowColor: "#1A1612", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 6, gap: 16,
  },
  row:   { flexDirection: "row", gap: 12 },
  field: { gap: 6 },
  label: { fontSize: 10, fontWeight: "700", color: C.text3, letterSpacing: 1 },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 14, color: C.text },
  rolesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roleChip:  { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border },
  roleChipActive: { backgroundColor: C.orangeBg, borderColor: C.orange },
  roleChipText:   { fontSize: 12, color: C.text3, fontWeight: "600" },
  roleChipTextActive: { color: C.orange },
  btnPrimary: { backgroundColor: C.orange, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  btnPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnLink:    { alignItems: "center", paddingVertical: 4 },
  btnLinkText:{ color: C.text3, fontSize: 13 },
});
