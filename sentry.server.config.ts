import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/observability/sentry-scrub";

/**
 * Server-side error reporting.
 *
 * Deliberately server and edge only for now: the browser SDK would add to the
 * initial JavaScript bundle, which CLAUDE.md caps at 250 KB gzipped, and the
 * blind spot that actually matters today is a request failing for a teacher
 * with nobody finding out. Adding the browser side is a separate decision with
 * a measured bundle cost.
 *
 * With no DSN configured the SDK initialises to a no-op, so development and CI
 * transmit nothing without needing a flag.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,

  // Never attach IP addresses, cookies or request bodies automatically.
  sendDefaultPii: false,

  // Errors matter here; performance traces would multiply the event volume for
  // a single school without answering a question anyone is asking yet.
  tracesSampleRate: 0,

  beforeSend(event) {
    return scrubEvent(event);
  },
});
