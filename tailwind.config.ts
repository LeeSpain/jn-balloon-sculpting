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
        coral: "#FF6F61",
        "coral-dark": "#e85d4f",
        gold: "#D4AF7A",
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
