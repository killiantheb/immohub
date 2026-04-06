"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7F3EE]">
      <h2 className="text-lg font-semibold text-gray-800">Une erreur est survenue</h2>
      <p className="text-sm text-gray-500">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-lg bg-[#E8601C] px-4 py-2 text-sm font-medium text-white hover:bg-[#cc4e0f]"
      >
        Réessayer
      </button>
    </div>
  );
}
