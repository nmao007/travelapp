import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production checks must not overwrite a running development server's artifacts.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  devIndicators: false,
  serverExternalPackages: ['geo-tz'],
  outputFileTracingIncludes: { '/api/destinations': ['./node_modules/geo-tz/data/**/*'] },
};

export default nextConfig;
