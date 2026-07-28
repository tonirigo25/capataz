import type { Metadata } from "next";
import { PRIVATE_ROBOTS_METADATA } from "@/lib/public-indexing";

export const metadata: Metadata = { robots: PRIVATE_ROBOTS_METADATA, manifest: "/manifest.webmanifest" };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
