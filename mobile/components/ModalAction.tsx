import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { SphereAction } from "@/lib/types";
import { C } from "@/lib/constants";
import { api } from "@/lib/api";

interface Props {
  action:  SphereAction | null;
  visible: boolean;
  onClose: () => void;
  onDone:  () => void;
}

/**
 * ModalAction — Bottom sheet modal for executing / confirming a Sphere action.
 * Handles: notation (star rating), document, validation, generic.
 */
export function ModalAction({ action, visible, onClose, onDone }: Props) {
  const [starHover,   setStarHover]   = useState(0);
  const [starScore,   setStarScore]   = useState(0);
  const [executing,   setExecuting]   = useState(false);
  const [done,        setDone]        = useState(false);

  // Reset on open
  React.useEffect(() => {
    if (visible) { setStarScore(0); setStarHover(0); setDone(false); }
  }, [visible]);

  if (!action) return null;

  const isNotation = action.type === "notation_action";

  async function executer(ctaLabel?: string) {
    setExecuting(true);
    try {
      if (isNotation && action.acteur_id) {
        await api.post("/notations/", { acteur_id: action.acteur_id, score: starScore });
      } else {
        await api.post("/sphere/executer", { action_id: action.id, cta: ctaLabel });
      }
      setDone(true);
      setTimeout(() => { onDone(); onClose(); }, 1200);
    } catch {
      // silent — user can retry
    } finally {
      setExecuting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.titre} numberOfLines={2}>
              {action.titre ?? action.description ?? "Action Althy"}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {action.description && !isNotation && (
            <Text style={styles.description}>{action.description}</Text>
          )}

          {/* NOTATION special layout */}
          {isNotation && (
            <View style={styles.notationSection}>
              <Text style={styles.notationLabel}>
                Comment s&apos;est passée la mission
                {action.acteur_nom ? ` avec ${action.acteur_nom}` : ""} ?
              </Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setStarScore(n)}
                    style={[
                      styles.starBtn,
                      { backgroundColor: (starHover || starScore) >= n ? C.orangeBg : C.surface2 },
                    ]}
                  >
                    <Text style={[styles.starIcon, { color: (starHover || starScore) >= n ? C.orange : C.border }]}>
                      ★
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {starScore > 0 && (
                <Text style={styles.scoreLabel}>
                  {["", "Décevant", "Passable", "Correct", "Très bien", "Excellent"][starScore]}
                </Text>
              )}
            </View>
          )}

          {/* Done state */}
          {done && (
            <View style={styles.doneBox}>
              <Text style={styles.doneText}>✓ Action effectuée</Text>
            </View>
          )}

          {/* CTA buttons */}
          {!done && (
            <View style={styles.ctaSection}>
              {isNotation ? (
                <TouchableOpacity
                  style={[styles.ctaPrimary, { opacity: starScore === 0 || executing ? 0.5 : 1 }]}
                  disabled={starScore === 0 || executing}
                  onPress={() => executer()}
                >
                  {executing
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.ctaPrimaryText}>Envoyer l&apos;avis</Text>
                  }
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.ctaPrimary, { opacity: executing ? 0.6 : 1 }]}
                    disabled={executing}
                    onPress={() => executer(action.cta_principal)}
                  >
                    {executing
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.ctaPrimaryText}>{action.cta_principal ?? "Valider"}</Text>
                    }
                  </TouchableOpacity>

                  {action.cta_secondaire && (
                    <TouchableOpacity style={styles.ctaSecondary} onPress={onClose}>
                      <Text style={styles.ctaSecondaryText}>{action.cta_secondaire}</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              <TouchableOpacity style={styles.ctaIgnore} onPress={onClose}>
                <Text style={styles.ctaIgnoreText}>Ignorer</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: "rgba(26,22,18,0.45)",
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius:  22,
    borderTopRightRadius: 22,
    paddingHorizontal:    20,
    paddingBottom:        36,
    maxHeight:            "75%",
  },
  handle: {
    width:         40,
    height:        4,
    borderRadius:  2,
    backgroundColor: C.border,
    alignSelf:     "center",
    marginTop:     12,
    marginBottom:  16,
  },
  header: {
    flexDirection:  "row",
    alignItems:     "flex-start",
    gap:            12,
    marginBottom:   12,
  },
  titre: {
    flex:       1,
    fontSize:   16,
    fontWeight: "700",
    color:      C.text,
    lineHeight: 22,
  },
  closeBtn: {
    padding: 4,
  },
  closeIcon: {
    fontSize: 14,
    color:    C.text3,
  },
  description: {
    fontSize:   13,
    color:      C.text3,
    lineHeight: 20,
    marginBottom: 20,
  },
  notationSection: {
    marginBottom: 20,
  },
  notationLabel: {
    fontSize:   14,
    fontWeight: "600",
    color:      C.text,
    marginBottom: 16,
    lineHeight: 20,
  },
  starsRow: {
    flexDirection:  "row",
    gap:            10,
    marginBottom:   12,
  },
  starBtn: {
    width:          44,
    height:         44,
    borderRadius:   22,
    alignItems:     "center",
    justifyContent: "center",
  },
  starIcon: {
    fontSize: 22,
  },
  scoreLabel: {
    fontSize:   13,
    fontWeight: "700",
    color:      C.orange,
    textAlign:  "center",
  },
  doneBox: {
    backgroundColor: C.greenBg,
    borderRadius:    12,
    padding:         16,
    alignItems:      "center",
    marginBottom:    16,
  },
  doneText: {
    color:      C.green,
    fontWeight: "700",
    fontSize:   14,
  },
  ctaSection: {
    gap: 10,
    marginTop: 8,
  },
  ctaPrimary: {
    backgroundColor: C.orange,
    borderRadius:    12,
    paddingVertical: 14,
    alignItems:      "center",
  },
  ctaPrimaryText: {
    color:      "#fff",
    fontSize:   14,
    fontWeight: "700",
  },
  ctaSecondary: {
    backgroundColor: C.surface2,
    borderRadius:    12,
    paddingVertical: 12,
    alignItems:      "center",
  },
  ctaSecondaryText: {
    color:    C.text2,
    fontSize: 13,
  },
  ctaIgnore: {
    paddingVertical: 10,
    alignItems:      "center",
  },
  ctaIgnoreText: {
    color:    C.text3,
    fontSize: 13,
  },
});
