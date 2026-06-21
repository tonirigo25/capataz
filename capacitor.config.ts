import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl =
  process.env.CAPATAZ_MOBILE_SERVER_URL ||
  process.env.NEXT_PUBLIC_WEB_BASE_URL ||
  "https://capataz.app";

const config: CapacitorConfig = {
  appId: "com.capataz.app",
  appName: "Capataz",
  webDir: "mobile-web",
  server: {
    url: serverUrl,
    cleartext: true
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
