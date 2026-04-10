// ── Althy design tokens (mirroring CSS vars) ─────────────────────────────────
export const C = {
  orange:    "#E8602C",
  orangeBg:  "#FDF1EB",
  bg:        "#FAF8F5",
  surface:   "#FFFFFF",
  surface2:  "#F5F0EA",
  border:    "#EAE3D9",
  text:      "#1A1612",
  text2:     "#3D3530",
  text3:     "#8A7A6A",
  green:     "#2E5E22",
  greenBg:   "#EBF4E8",
  red:       "#C0392B",
  redBg:     "#FDECEA",
  amber:     "#B45309",
  amberBg:   "#FEF3C7",
  blue:      "#1D4ED8",
  blueBg:    "#EFF6FF",
  sidebar:   "#1A1612",
} as const;

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://api.althy.ch/api/v1";

export const SUPABASE_URL       = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY  = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
