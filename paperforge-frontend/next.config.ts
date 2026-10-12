import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("..", import.meta.url)),
  turbopack: { root: fileURLToPath(new URL("..", import.meta.url)) },
  experimental: { cssChunking: "strict" },
};

export default nextConfig;
