import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/video-editor",
        destination: "/ai-video",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
