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
        // Althy — or chaud sur fond ivoire
        primary: {
          50:  "#fdf8f0",
          100: "#f7edd8",
          200: "#edd9b0",
          300: "#dfc07f",
          400: "#cfa458",
          500: "#B68A4A",
          600: "#9A7038",
          700: "#7D5929",
          800: "#5E411C",
          900: "#3A280F",
        },
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
