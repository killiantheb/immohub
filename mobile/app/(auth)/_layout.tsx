import { Stack } from "expo-router";
import { C } from "@/lib/constants";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle:      { backgroundColor: C.bg },
        headerTintColor:  C.orange,
        headerBackTitle:  "Retour",
        headerShadowVisible: false,
        contentStyle:     { backgroundColor: C.bg },
      }}
    >
      <Stack.Screen name="connexion"  options={{ title: "", headerShown: false }} />
      <Stack.Screen name="inscription" options={{ title: "Créer un compte", headerShown: true }} />
    </Stack>
  );
}
