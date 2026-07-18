import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--cap-bg-rgb) / <alpha-value>)",
        subtle: "rgb(var(--cap-bg-subtle-rgb) / <alpha-value>)",
        surface: "rgb(var(--cap-surface-rgb) / <alpha-value>)",
        border: {
          DEFAULT: "rgb(var(--cap-border-rgb) / <alpha-value>)",
          strong: "rgb(var(--cap-border-strong-rgb) / <alpha-value>)"
        },
        content: {
          DEFAULT: "rgb(var(--cap-text-rgb) / <alpha-value>)",
          secondary: "rgb(var(--cap-text-muted-rgb) / <alpha-value>)",
          tertiary: "rgb(var(--cap-text-soft-rgb) / <alpha-value>)"
        },
        brand: {
          DEFAULT: "rgb(var(--cap-brand-rgb) / <alpha-value>)",
          strong: "rgb(var(--cap-brand-strong-rgb) / <alpha-value>)",
          soft: "rgb(var(--cap-brand-soft-rgb) / <alpha-value>)"
        },
        accent: "rgb(var(--cap-accent-rgb) / <alpha-value>)",
        success: "rgb(var(--cap-success-rgb) / <alpha-value>)",
        warning: "rgb(var(--cap-warning-rgb) / <alpha-value>)",
        danger: "rgb(var(--cap-danger-rgb) / <alpha-value>)",
        info: "rgb(var(--cap-info-rgb) / <alpha-value>)",
        // Compatibilidad transitoria: no usar estos aliases en componentes nuevos.
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
        card: "var(--cap-shadow-overlay)",
        soft: "var(--cap-shadow-subtle)"
      },
      maxWidth: {
        product: "var(--cap-content-max)",
        analytical: "var(--cap-analytics-max)",
        reading: "var(--cap-reading-max)",
        form: "var(--cap-form-max)",
        entity: "var(--cap-entity-max)"
      },
      transitionDuration: {
        control: "var(--cap-motion-control)",
        menu: "var(--cap-motion-menu)",
        panel: "var(--cap-motion-panel)"
      }
    }
  },
  plugins: []
};

export default config;
