"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";

import { createClient } from "./supabase";
import { api } from "./api";
import { useAuthStore } from "./store/authStore";
import type { UserProfile } from "./types";

// ── query keys ────────────────────────────────────────────────────────────────

export const authKeys = {
  user: ["auth", "user"] as const,
  profile: ["auth", "profile"] as const,
};

// ── useAuth ───────────────────────────────────────────────────────────────────

/**
 * Core auth hook — provides session state + sign-in / sign-up / sign-out helpers.
 * Keeps the Zustand store in sync with the Supabase session.
 */
export function useAuth() {
  const supabase = createClient();
  const { user, setUser, clearUser } = useAuthStore();
  const queryClient = useQueryClient();

  // Subscribe to Supabase auth state changes on mount
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        clearUser();
        queryClient.removeQueries({ queryKey: authKeys.profile });
      }
    });

    // Hydrate from existing session
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) setUser(data.user);
    return data;
  };

  const signUp = async (
    email: string,
    password: string,
    metadata: {
      first_name: string;
      last_name: string;
      role?: string;
      cgu_accepted_at?: string;
      cgu_version?: string;
      marketing_consent?: boolean;
    },
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) throw error;
    // When email confirmation is enabled, Supabase silently "succeeds" for
    // existing emails but returns an empty identities array instead of an error.
    if (data.user?.identities?.length === 0) {
      throw new Error("User already registered");
    }
    if (data.user) setUser(data.user);
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearUser();
    queryClient.clear();
  };

  return { user, signIn, signUp, signOut, isAuthenticated: !!user };
}

// ── useUser ───────────────────────────────────────────────────────────────────

/**
 * Returns the full DB user profile fetched from our backend `/auth/me`.
 * Only runs when the user is authenticated (has a Supabase session).
 */
export function useUser() {
  const { user: supabaseUser } = useAuthStore();

  return useQuery<UserProfile>({
    queryKey: authKeys.profile,
    queryFn: async () => {
      const { data } = await api.get<UserProfile>("/auth/me");
      return data;
    },
    enabled: !!supabaseUser,
    staleTime: 5 * 60 * 1000, // 5 min
    retry: (count, err: unknown) => {
      // Don't retry on 401/403
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return count < 2;
    },
  });
}

// ── useRequireAuth ────────────────────────────────────────────────────────────

/**
 * Redirects to /login if the user is not authenticated.
 * Returns { user, profile, isLoading } once resolved.
 */
export function useRequireAuth(redirectTo = "/login") {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { data: profile, isLoading: profileLoading } = useUser();

  useEffect(() => {
    // Give Supabase a tick to hydrate before redirecting
    const timer = setTimeout(() => {
      if (!isAuthenticated) {
        router.replace(redirectTo);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isAuthenticated, redirectTo, router]);

  return {
    user,
    profile,
    isLoading: !user || profileLoading,
    isAuthenticated,
  };
}
