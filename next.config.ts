import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Receipt photos are posted to a server action (the server caps them at 4 MB; Vercel at 4.5 MB).
    serverActions: { bodySizeLimit: "4.5mb" },
  },
};

export default nextConfig;
