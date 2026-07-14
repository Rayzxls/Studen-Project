import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: {
    // Allow a higher-quality variant for crisp hero art (e.g. the landing
    // "how it works" 3D render); 75 stays the default for everything else.
    qualities: [75, 90],
  },
};

export default nextConfig;
