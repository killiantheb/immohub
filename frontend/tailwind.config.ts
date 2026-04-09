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
        // Althy — terre cuite Hermès sur fond ivoire
        primary: {
          50:  "#FEF5EF",
          100: "#FDE3D0",
          200: "#FAC4A0",
          300: "#F5A070",
          400: "#EF7A42",
          500: "#E8602C",   // ← couleur principale althy-orange
          600: "#C44820",
          700: "#9E3418",
          800: "#7A2510",
          900: "#4A1408",
        },
        // Ivoire chaud — surfaces
        stone: {
          50:  "#FAFAF8",
          100: "#F3F1EC",
          200: "#E8E5DE",
          300: "#D6D1C7",
          400: "#BDB6A8",
          500: "#9A9088",
          600: "#706860",
          700: "#4C4740",
          800: "#2E2A24",
          900: "#1A1814",
        },
      },
      fontFamily: {
        sans:  ["var(--font-sans)", "DM Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Cormorant Garamond", "Georgia", "serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
      boxShadow: {
        "althy":    "0 1px 4px rgba(26,24,20,0.05), 0 1px 2px rgba(26,24,20,0.03)",
        "althy-md": "0 4px 20px rgba(26,24,20,0.07), 0 1px 4px rgba(26,24,20,0.04)",
        "althy-lg": "0 8px 40px rgba(26,24,20,0.09), 0 2px 8px rgba(26,24,20,0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
