"use client";

import { useCallback, useRef, useState } from "react";

export interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
    country_code?: string;
  };
}

const USER_AGENT = "Althy/1.0 contact@althy.ch";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Respect OSM fair-use: 1 req/sec
const MIN_INTERVAL_MS = 1100;

export function useNominatim() {
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReqAt = useRef<number>(0);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 3) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      const now = Date.now();
      const wait = MIN_INTERVAL_MS - (now - lastReqAt.current);
      if (wait > 0) await new Promise(r => setTimeout(r, wait));
      lastReqAt.current = Date.now();

      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          format: "json",
          addressdetails: "1",
          limit: "6",
          countrycodes: "ch,fr,de,at,it",
        });
        const res = await fetch(`${NOMINATIM_URL}?${params}`, {
          headers: { "User-Agent": USER_AGENT },
        });
        setResults(await res.json());
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setResults([]);
  }, []);

  return { search, results, loading, clear };
}

/** One-shot geocode — resolves to [lat, lng] or null. */
export async function geocodeSingle(address: string): Promise<[number, number] | null> {
  try {
    const params = new URLSearchParams({ q: address, format: "json", limit: "1" });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    const data: NominatimResult[] = await res.json();
    if (!data.length) return null;
    return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {
    return null;
  }
}
