import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination:
          "https://inthehole-2f53d.firebaseapp.com/__/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
