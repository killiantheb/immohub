import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Althy — Bleu de Prusse + Or (CLAUDE.md)
        primary: {
          50:  "#F0F4F9",
          100: "#D6E0ED",
          200: "#AEC2D8",
          300: "#7E9BBE",
          400: "#4C73A0",
          500: "#0F2E4C",   // ← Bleu de Prusse principal
          600: "#0C263F",
          700: "#091D30",
          800: "#061422",
          900: "#030B14",
        },
        prussian: {
          DEFAULT: "#0F2E4C",
          light:   "rgba(15,46,76,0.08)",
          hover:   "#1A4975",
          border:  "rgba(15,46,76,0.22)",
        },
        signature: "#1A4975",
        gold: {
          DEFAULT: "#C9A961",
          light:   "rgba(201,169,97,0.12)",
          bg:      "#FEF9E7",
          hover:   "#B5975A",
        },
        // Transition — alias orange qui pointe vers le prussian
        orange: {
          500: "#0F2E4C",
        },
        // Stone — fond et surfaces
        stone: {
          50:  "#FAFAF8",   // --althy-bg
          100: "#F5F2EC",
          200: "#E8E4DC",   // --althy-border
          300: "#D6D1C7",
          400: "#BDB6A8",
          500: "#9A9088",
          600: "#7A7469",   // --althy-text-3 muted
          700: "#5C5650",   // --althy-text-2
          800: "#3D3830",   // --althy-text
          900: "#1E1C18",
        },
        // Sage — succès
        sage: {
          50:  "#EBF2EA",   // --althy-green-bg
          100: "#D5E8D3",
          200: "#AACFA6",
          300: "#7FB37A",
          400: "#5A7D54",   // --althy-green
          500: "#3E6138",
          600: "#2E4E28",
          700: "#1E3B1A",
          800: "#122710",
          900: "#091408",
        },
      },
      fontFamily: {
        sans:  ["var(--font-sans)", "DM Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Fraunces", "Georgia", "serif"],
      },
      borderRadius: {
        card: "12px",
        elem: "8px",
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        "althy":    "0 1px 3px rgba(61,56,48,0.06), 0 1px 2px rgba(61,56,48,0.04)",
        "althy-md": "0 4px 18px rgba(61,56,48,0.08), 0 1px 4px rgba(61,56,48,0.04)",
        "althy-lg": "0 8px 36px rgba(61,56,48,0.10), 0 2px 8px rgba(61,56,48,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
