import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/app/pwa-register";
import { brand } from "@/lib/brand";
import { ThemeProvider, themeBootScript } from "@/components/theme/theme-provider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_BASE_URL || "http://localhost:3000"),
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
  alternates: { canonical: "/" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1718" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        {children}
        <ThemeProvider />
        <PwaRegister />
      </body>
    </html>
  );
}
