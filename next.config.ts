import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://api.liffy.app/api/:path*',
      },
    ];
  },
};

export default nextConfig;
