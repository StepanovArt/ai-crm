import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `next build` also emits a minimal self-contained server (used by the Docker image).
  output: "standalone",
  devIndicators: false,
};

export default nextConfig;
