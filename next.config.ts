import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel and Netlify handle output automatically — no standalone config needed.
  // For Netlify, install @netlify/next as a build plugin instead.
  reactStrictMode: true,
  // Hide the Next.js dev tools floating button (production builds never show it)
  devIndicators: false,
  images: {
    // Allow external image domains if needed
    remotePatterns: [],
  },
};

export default nextConfig;
