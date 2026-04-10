import React, { useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { SphereAction, Urgence } from "@/lib/types";
import { C } from "@/lib/constants";

// ── Urgence config ────────────────────────────────────────────────────────────

const URGENCE_COLOR: Record<Urgence, string> = {
  haute:   C.red,
  normale: C.orange,
  info:    C.blue,
};
const URGENCE_BG: Record<Urgence, string> = {
  haute:   C.redBg,
  normale: C.orangeBg,
  info:    C.blueBg,
};
const URGENCE_LABEL: Record<Urgence, string> = {
  haute:   "URGENT",
  normale: "À FAIRE",
  info:    "INFO",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  action:    SphereAction;
  onPress:   (action: SphereAction) => void;
  onIgnorer: (id: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CarteAction({ action, onPress, onIgnorer }: Props) {
  const urgence: Urgence = action.urgence ?? "normale";
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  }
  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  }

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => onPress(action)}
        style={[styles.card, { borderLeftColor: URGENCE_COLOR[urgence] }]}
      >
        {/* Badge urgence */}
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: URGENCE_BG[urgence] }]}>
            <Text style={[styles.badgeText, { color: URGENCE_COLOR[urgence] }]}>
              {URGENCE_LABEL[urgence]}
            </Text>
          </View>
          {action.type && (
            <Text style={styles.typeLabel}>
              {action.type.replace("_action", "").replace("_", " ")}
            </Text>
          )}
          {/* Dismiss button */}
          <TouchableOpacity
            onPress={() => onIgnorer(action.id)}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            style={styles.dismissBtn}
          >
            <Text style={styles.dismissIcon}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {action.titre && (
          <Text style={styles.titre} numberOfLines={2}>{action.titre}</Text>
        )}
        {action.description && (
          <Text style={styles.description} numberOfLines={3}>{action.description}</Text>
        )}

        {/* CTAs */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.ctaPrimary, { backgroundColor: URGENCE_COLOR[urgence] }]}
            onPress={() => onPress(action)}
          >
            <Text style={styles.ctaPrimaryText}>
              {action.cta_principal ?? "Voir"}
            </Text>
          </TouchableOpacity>

          {action.cta_secondaire && (
            <TouchableOpacity
              style={styles.ctaSecondary}
              onPress={() => onIgnorer(action.id)}
            >
              <Text style={styles.ctaSecondaryText}>{action.cta_secondaire}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 10,
  },
  card: {
    backgroundColor:  C.surface,
    borderRadius:     14,
    borderLeftWidth:  4,
    padding:          14,
    shadowColor:      "#1A1612",
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.06,
    shadowRadius:     6,
    elevation:        3,
  },
  header: {
    flexDirection:  "row",
    alignItems:     "center",
    marginBottom:   8,
    gap:            8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical:   2,
    borderRadius:      5,
  },
  badgeText: {
    fontSize:    9,
    fontWeight:  "800",
    letterSpacing: 0.6,
  },
  typeLabel: {
    fontSize: 10,
    color:    C.text3,
    flex:     1,
    textTransform: "capitalize",
  },
  dismissBtn: {
    padding: 4,
  },
  dismissIcon: {
    color:    C.text3,
    fontSize: 12,
  },
  titre: {
    fontSize:   14,
    fontWeight: "700",
    color:      C.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  description: {
    fontSize:   12,
    color:      C.text3,
    lineHeight: 18,
    marginBottom: 12,
  },
  ctaRow: {
    flexDirection: "row",
    gap:           8,
  },
  ctaPrimary: {
    flex:           1,
    paddingVertical: 9,
    borderRadius:   10,
    alignItems:     "center",
  },
  ctaPrimaryText: {
    color:      "#fff",
    fontSize:   13,
    fontWeight: "700",
  },
  ctaSecondary: {
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderRadius:      10,
    backgroundColor:   C.surface2,
    alignItems:        "center",
  },
  ctaSecondaryText: {
    color:    C.text3,
    fontSize: 13,
  },
});
