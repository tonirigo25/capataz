import type { CapacitorConfig } from "@capacitor/cli";
import { resolveMobileConfig } from "./lib/mobile-config";

const mobile = resolveMobileConfig(process.env);

const config: CapacitorConfig = {
  appId: mobile.appId,
  appName: mobile.appName,
  webDir: "mobile-web",
  server: {
    url: mobile.serverUrl,
    cleartext: mobile.cleartext,
    allowNavigation: [mobile.appLinkHost]
  },
  android: {
    allowMixedContent: mobile.allowMixedContent
  }
};

export default config;
