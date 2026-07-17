import type { CapacitorConfig } from "@capacitor/cli";
import { resolveMobileConfig } from "./lib/mobile-config";

const mobile = resolveMobileConfig(process.env);

const config: CapacitorConfig = {
  appId: "com.capataz.app",
  appName: "Capataz",
  webDir: "mobile-web",
  server: {
    url: mobile.serverUrl,
    cleartext: mobile.cleartext
  },
  android: {
    allowMixedContent: mobile.allowMixedContent
  }
};

export default config;
