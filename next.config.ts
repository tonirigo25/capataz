import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/documentos/plantillas/[slug]": ["./templates/documents/**/*"]
  }
};

export default nextConfig;
