import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { PwaRegister } from "@/app/pwa-register";
import { brand } from "@/lib/brand";
import { getPublicRobotsMetadata } from "@/lib/public-indexing";
import { ThemeProvider, themeBootScript } from "@/components/theme/theme-provider";
import { headers } from "next/headers";
import { ConsentManager } from "@/components/consent-manager";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(brand.publicUrl),
    title: { default: brand.metadata.title, template: brand.metadata.titleTemplate },
    description: brand.metadata.description,
    applicationName: brand.productName,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: brand.pwa.name
    },
    icons: {
      icon: [
        { url: "/brand/favicon.svg", type: "image/svg+xml" },
        { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }
      ],
      apple: "/brand/apple-touch-icon.png"
    },
    alternates: { canonical: "/" },
    robots: getPublicRobotsMetadata(),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1718" }
  ]
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        {children}
        <ConsentManager analyticsAvailable={process.env.ANALYTICS_ENABLED === "true"} />
        <ThemeProvider />
        <PwaRegister />
      </body>
    </html>
  );
}
