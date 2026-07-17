import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Legacy remote avatars (if any remaining in DB)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
    ],
  },
};

export default nextConfig;
