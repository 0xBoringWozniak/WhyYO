import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f5f5f0",
        fog: "#080808",
        sand: "#171717",
        sage: "#d7ff1f",
        ember: "#8a8a8a",
        steel: "#323232",
        void: "#050505",
        panel: "#151515",
        lime: "#d7ff1f",
        mint: "#16f88f",
        cyan: "#61d9ff",
        amber: "#ffb347",
        indigo: "#5c74ff",
      },
      fontFamily: {
        sans: ["var(--font-body)", "sans-serif"],
        display: ["var(--font-display)", "sans-serif"],
      },
      boxShadow: {
        panel: "0 24px 80px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
