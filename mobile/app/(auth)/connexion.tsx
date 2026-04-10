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

export default function ConnexionScreen() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  async function seConnecter() {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      });
      if (error) {
        Alert.alert("Connexion impossible", "Email ou mot de passe incorrect.");
      } else {
        router.replace("/(onglets)/sphere");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logoText}>ALTHY</Text>
          <Text style={styles.tagline}>L'assistant immobilier suisse</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connexion</Text>

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="vous@agence.ch"
              placeholderTextColor={C.text3}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>MOT DE PASSE</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={C.text3}
              secureTextEntry
              autoComplete="password"
              onSubmitEditing={seConnecter}
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, { opacity: loading ? 0.7 : 1 }]}
            onPress={seConnecter}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnPrimaryText}>Se connecter</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnLink}
            onPress={() => router.push("/(auth)/inscription")}
          >
            <Text style={styles.btnLinkText}>
              Pas encore de compte ? <Text style={{ color: C.orange, fontWeight: "700" }}>S'inscrire</Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mention */}
        <Text style={styles.mention}>
          En vous connectant, vous acceptez les{"\n"}conditions d'utilisation d'Althy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: C.bg },
  container: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  logoSection: { alignItems: "center", marginBottom: 36 },
  logoText: {
    fontFamily: "serif",
    fontSize:   38,
    fontWeight: "300",
    color:      C.orange,
    letterSpacing: 10,
    marginBottom: 6,
  },
  tagline: { color: C.text3, fontSize: 13 },

  card: {
    width:           "100%",
    backgroundColor: C.surface,
    borderRadius:    20,
    padding:         24,
    shadowColor:     "#1A1612",
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.08,
    shadowRadius:    16,
    elevation:       6,
    gap:             16,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: C.text },

  field: { gap: 6 },
  label: {
    fontSize:    10,
    fontWeight:  "700",
    color:       C.text3,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: C.bg,
    borderWidth:     1,
    borderColor:     C.border,
    borderRadius:    10,
    padding:         12,
    fontSize:        14,
    color:           C.text,
  },

  btnPrimary: {
    backgroundColor: C.orange,
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      "center",
    marginTop:       4,
  },
  btnPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  btnLink:     { alignItems: "center", paddingVertical: 4 },
  btnLinkText: { color: C.text3, fontSize: 13 },

  mention: { color: C.text3, fontSize: 11, textAlign: "center", marginTop: 24, lineHeight: 18 },
});
