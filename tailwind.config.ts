import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // J&N brand palette (from the design bundle)
        cream: "#FBF7F2",
        plum: "#4A2C4D",
        coral: "#FF6F61", // bright brand accent — decorative / on-dark use
        "coral-dark": "#e85d4f",
        "coral-deep": "#c9402f", // WCAG-AA (4.9:1 vs white) — solid buttons & text on light
        gold: "#D4AF7A", // on plum/dark only
        "gold-ink": "#8a6a3a", // WCAG-AA (4.6:1 vs cream) — labels on light backgrounds
        blush: "#F3C6C6",
        "plum-soft": "#7a5f7d",
      },
      fontFamily: {
        display: ["var(--font-playfair)", "serif"],
        sans: ["var(--font-nunito)", "sans-serif"],
      },
      maxWidth: {
        site: "1060px",
        admin: "1100px",
      },
      boxShadow: {
        card: "0 4px 14px rgba(74,44,77,0.08)",
        panel: "0 8px 28px rgba(74,44,77,0.10)",
        coral: "0 4px 14px rgba(255,111,97,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
