// ── Althy design tokens (alignés sur globals.css — source unique) ─────────────
export const C = {
  orange:    "#E8602C",
  orangeBg:  "rgba(232,96,44,0.08)",
  bg:        "#FAF9F6",
  surface:   "#FFFFFF",
  surface2:  "#FAF9F6",
  border:    "#EDE9E3",
  text:      "#2B2B2B",
  text2:     "#6E6A65",
  text3:     "#A8A29E",
  green:     "#22B573",
  greenBg:   "#E8F8F0",
  red:       "#E53E3E",
  redBg:     "#FEF0EF",
  amber:     "#B45309",
  amberBg:   "#FFF6E5",
  blue:      "#4B8BF5",
  blueBg:    "#EEF3FE",
  sidebar:   "#FFFFFF",
} as const;

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.althy.ch/api/v1";

export const SUPABASE_URL       = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
