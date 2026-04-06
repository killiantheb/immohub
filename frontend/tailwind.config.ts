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
        // CATHY brand — orange primary, beige background
        // Hermès orange — Pantone 021 C
        primary: {
          50:  "#fff3eb",
          100: "#fde0c8",
          200: "#f9bb91",
          300: "#f4905a",
          400: "#ef6c2e",
          500: "#E8601C",
          600: "#cc4e0f",
          700: "#a83d0b",
          800: "#7c2d08",
          900: "#4f1c04",
        },
        beige: {
          50:  "#fdfaf5",
          100: "#faf5eb",
          200: "#f5ead6",
          300: "#eedfc0",
          400: "#e5d0a3",
          500: "#d9bc80",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
