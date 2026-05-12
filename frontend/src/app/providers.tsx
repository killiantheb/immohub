"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { ThemeProvider } from "next-themes";
import { PostHogProvider } from "@/components/PostHogProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            // Sprint perf quick-wins (2026-05-12) : désactivation des refetch
            // automatiques par défaut. L'audit HAR a révélé 3× refetch en 60s
            // sur le même endpoint dossier (3-5s wait serveur × 3 = 9-15s
            // de wait inutile côté locataire). Les hooks qui NEED un polling
            // doivent l'opt-in explicitement via `refetchInterval` (ex:
            // useMessages PR-3 messagerie qui poll 15s).
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
