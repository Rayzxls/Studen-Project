import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/observability/sentry-scrub";

/**
 * Edge runtime reporting — the proxy/middleware path. Same redaction contract
 * as the server config; see `sentry.server.config.ts` for why the browser SDK
 * is left out.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend(event) {
    return scrubEvent(event);
  },
});
