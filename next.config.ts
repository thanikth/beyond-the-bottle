import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  images: {
    domains: ['profile.line-scdn.net'], //host LINE
  },
};

export default nextConfig;
