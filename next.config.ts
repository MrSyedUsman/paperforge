import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: { cssChunking: "strict" },
};

export default nextConfig;
