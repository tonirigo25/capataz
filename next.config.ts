import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "11mb" },
    middlewareClientMaxBodySize: "11mb"
  },
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/documentos/plantillas/[slug]": ["./templates/documents/**/*"]
  },
  async headers() {
    const headers = [
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=()" }
    ];
    if (process.env.NEXT_PUBLIC_APP_ENV === "staging") headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" });
    return [{ source: "/:path*", headers }];
  }
};

export default nextConfig;
