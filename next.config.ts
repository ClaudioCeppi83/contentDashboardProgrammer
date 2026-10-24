import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
