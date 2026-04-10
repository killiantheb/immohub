import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Tabs } from "expo-router";
import { C } from "@/lib/constants";
import { api } from "@/lib/api";

// ── Tab icons (simple Unicode emoji approach — no extra icon lib needed) ──────

function TabIcon({ emoji, focused, size = 22 }: { emoji: string; focused: boolean; size?: number }) {
  return (
    <Text style={{ fontSize: size, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

// Sphere icon — larger, orange pill background when focused
function SphereTabIcon({ focused }: { focused: boolean }) {
  return (
    <View style={{
      width:           52,
      height:          52,
      borderRadius:    26,
      backgroundColor: focused ? C.orange : C.surface2,
      alignItems:      "center",
      justifyContent:  "center",
      marginTop:       -12,
      shadowColor:     focused ? C.orange : "transparent",
      shadowOffset:    { width: 0, height: 4 },
      shadowOpacity:   focused ? 0.4 : 0,
      shadowRadius:    8,
      elevation:       focused ? 6 : 0,
    }}>
      <Text style={{ fontSize: 24 }}>✦</Text>
    </View>
  );
}

// Badge component for messagerie
function BadgeIcon({ emoji, count }: { emoji: string; count: number }) {
  return (
    <View>
      <Text style={{ fontSize: 22, opacity: 0.8 }}>{emoji}</Text>
      {count > 0 && (
        <View style={{
          position:        "absolute",
          top:             -4,
          right:           -6,
          minWidth:        16,
          height:          16,
          borderRadius:    8,
          backgroundColor: C.red,
          alignItems:      "center",
          justifyContent:  "center",
          paddingHorizontal: 3,
        }}>
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "800" }}>
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function OngletsLayout() {
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll unread message count every 60s
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const r = await api.get<{ non_lus: number }>("/messagerie/non-lus");
        setUnreadCount(r.data.non_lus ?? 0);
      } catch {
        // ignore
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown:     false,
        tabBarStyle:     {
          backgroundColor:   C.surface,
          borderTopColor:    C.border,
          borderTopWidth:    1,
          paddingBottom:     8,
          paddingTop:        4,
          height:            72,
        },
        tabBarActiveTintColor:   C.orange,
        tabBarInactiveTintColor: C.text3,
        tabBarLabelStyle:        { fontSize: 10, fontWeight: "600", marginTop: 2 },
      }}
    >
      {/* ── Agenda ──────────────────────────────────────────────────── */}
      <Tabs.Screen
        name="agenda"
        options={{
          title:    "Agenda",
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
        }}
      />

      {/* ── Biens ───────────────────────────────────────────────────── */}
      <Tabs.Screen
        name="biens"
        options={{
          title:    "Biens",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />

      {/* ── Sphère (central, larger) ─────────────────────────────────── */}
      <Tabs.Screen
        name="sphere"
        options={{
          title:    "Althy",
          tabBarIcon: ({ focused }) => <SphereTabIcon focused={focused} />,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "800", marginTop: 2, color: C.orange },
        }}
      />

      {/* ── Messagerie (with badge) ──────────────────────────────────── */}
      <Tabs.Screen
        name="messagerie"
        options={{
          title:    "Messages",
          tabBarIcon: ({ focused }) => (
            <View style={{ opacity: focused ? 1 : 0.5 }}>
              <BadgeIcon emoji="✉️" count={unreadCount} />
            </View>
          ),
        }}
      />

      {/* ── Profil ──────────────────────────────────────────────────── */}
      <Tabs.Screen
        name="profil"
        options={{
          title:    "Profil",
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
