import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Legacy seed URLs; new photos are served from /fotos-funcionarios
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
    ],
  },
};

export default nextConfig;
