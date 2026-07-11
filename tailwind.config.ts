import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obra: {
          yellow: "rgb(var(--cap-brand-rgb) / <alpha-value>)",
          yellowDark: "rgb(var(--cap-brand-strong-rgb) / <alpha-value>)",
          ink: "rgb(var(--cap-text-rgb) / <alpha-value>)",
          graphite: "rgb(var(--cap-steel-rgb) / <alpha-value>)",
          concrete: "rgb(var(--cap-bg-rgb) / <alpha-value>)",
          orange: "rgb(var(--cap-warning-rgb) / <alpha-value>)",
          green: "rgb(var(--cap-success-rgb) / <alpha-value>)",
          red: "rgb(var(--cap-danger-rgb) / <alpha-value>)",
          info: "rgb(var(--cap-info-rgb) / <alpha-value>)",
          surface: "rgb(var(--cap-surface-rgb) / <alpha-value>)",
          muted: "rgb(var(--cap-surface-muted-rgb) / <alpha-value>)"
        }
      },
      boxShadow: {
        card: "var(--cap-shadow-md)",
        soft: "var(--cap-shadow-sm)"
      }
    }
  },
  plugins: []
};

export default config;
