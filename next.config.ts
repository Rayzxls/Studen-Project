import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: {
    // Allow a higher-quality variant for crisp hero art (e.g. the landing
    // "how it works" 3D render); 75 stays the default for everything else.
    qualities: [75, 90],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // Source maps upload only where an auth token exists, so local builds and CI
  // stay offline and fast.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableLogger: true,
  // The browser SDK is intentionally not initialised (see
  // sentry.server.config.ts for why), so client bundles stay untouched.
  widenClientFileUpload: false,
});
