/**
 * Root redirect — checks Supabase session and routes accordingly.
 */
import { useEffect } from "react";
import { Redirect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { C } from "@/lib/constants";

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [session, setSession]   = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
      setChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.orange} />
      </View>
    );
  }

  return <Redirect href={session ? "/(onglets)/sphere" : "/(auth)/connexion"} />;
}
