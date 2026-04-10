import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { registerForPushNotifications } from "@/lib/notifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:      1,
      staleTime:  30_000,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    // Register push notifications on mount
    registerForPushNotifications().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)"    options={{ headerShown: false }} />
        <Stack.Screen name="(onglets)" options={{ headerShown: false }} />
        <Stack.Screen name="index"     options={{ headerShown: false }} />
      </Stack>
    </QueryClientProvider>
  );
}
