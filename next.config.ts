import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // En Next.js 15, allowedDevOrigins puede ir en primer nivel o experimental
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.133"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 800, // Intervalo de sondeo en ms: evita inotify y erradica ENOSPC
        aggregateTimeout: 300,
        ignored: [
          "**/.git/**",
          "**/.agents/**",
          "**/docs/**",
          "**/tests/**",
          "**/node_modules/**",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
