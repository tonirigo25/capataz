import type { NextConfig } from "next";

const contentSecurityPolicyReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.openai.com https://api.resend.com https://api.stripe.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "report-uri /api/security/csp-report",
].join("; ");

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
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=()" },
      { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicyReportOnly },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Resource-Policy", value: "same-site" },
      { key: "X-Permitted-Cross-Domain-Policies", value: "none" }
    ];
    return [{ source: "/:path*", headers }];
  }
};

export default nextConfig;
