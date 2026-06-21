import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obra: {
          yellow: "#f6c945",
          yellowDark: "#b98309",
          ink: "#1f2428",
          graphite: "#3a4147",
          concrete: "#eef0f2",
          orange: "#f28c28",
          green: "#1f9d63",
          red: "#d94b4b"
        }
      },
      boxShadow: {
        card: "0 8px 22px rgba(31, 36, 40, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
