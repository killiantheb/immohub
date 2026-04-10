import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { C } from "@/lib/constants";

interface Props {
  size?:   number;
  pulsing?: boolean;
}

/**
 * Althy Sphere — animated orb for the mobile app.
 * Orange gradient rings that pulse when the AI is thinking.
 */
export function AlthySphereNative({ size = 80, pulsing = false }: Props) {
  const pulse  = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slow rotation always on
    Animated.loop(
      Animated.timing(rotate, {
        toValue:         1,
        duration:        8000,
        easing:          Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [rotate]);

  useEffect(() => {
    if (pulsing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.94, duration: 700, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      Animated.spring(pulse, { toValue: 1, useNativeDriver: true }).start();
    }
  }, [pulsing, pulse]);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {/* Outer glow ring */}
      <Animated.View style={[
        styles.ring,
        {
          width:  size * 1.4,
          height: size * 1.4,
          borderRadius: size * 0.7,
          borderColor: `${C.orange}30`,
          transform: [{ scale: pulse }],
        },
      ]} />
      {/* Mid ring */}
      <Animated.View style={[
        styles.ring,
        {
          width:  size * 1.15,
          height: size * 1.15,
          borderRadius: size * 0.575,
          borderColor: `${C.orange}60`,
          transform: [{ scale: pulse }, { rotate: spin }],
        },
      ]} />
      {/* Core sphere */}
      <Animated.View style={[
        styles.core,
        {
          width:  size,
          height: size,
          borderRadius: size / 2,
          transform: [{ scale: pulse }],
          backgroundColor: C.orange,
          shadowColor: C.orange,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: size * 0.2,
          elevation: 12,
        },
      ]}>
        {/* Inner highlight */}
        <View style={[styles.highlight, { width: size * 0.35, height: size * 0.35, borderRadius: size * 0.175 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems:     "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
  },
  core: {
    alignItems:     "center",
    justifyContent: "center",
  },
  highlight: {
    position:        "absolute",
    top:             "18%",
    left:            "18%",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
