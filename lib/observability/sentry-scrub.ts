/**
 * Redaction applied to everything before it leaves the process for Sentry.
 *
 * CLAUDE.md forbids logging passwords, tokens, cookies and signed URLs, and an
 * error report is a log with a network hop attached. The rules below are
 * deliberately blunt: over-redacting costs a little debugging context, while
 * under-redacting puts a student's session cookie or a private file's signed
 * URL on a third-party server.
 */

const REDACTED = "[redacted]";

/** Query parameters that carry credentials or grant access on their own. */
const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "code",
  "secret",
  "password",
  "signature",
  "x-amz-signature",
  "x-amz-credential",
  "x-amz-security-token",
  "access_token",
  "id_token",
  "refresh_token",
  "state",
  "nonce",
]);

/** Header names that must never be transmitted, whatever their value. */
const SENSITIVE_HEADERS = new Set([
  "cookie",
  "set-cookie",
  "authorization",
  "proxy-authorization",
  "x-api-key",
]);

/**
 * Strips credential-bearing query parameters while keeping the path, which is
 * usually the only part of a URL worth reading in a stack trace anyway.
 *
 * A signed R2 URL is the motivating case: its signature is the access grant, so
 * a report containing one hands over the file.
 */
export function scrubUrl(raw: string): string {
  // A relative path is parsed against a throwaway base; anything else must be
  // an absolute URL on its own. Parsing everything against a base would make
  // any string "valid" — including arbitrary user input that merely landed in
  // this field — and it would then be forwarded verbatim.
  const relative = raw.startsWith("/");
  let url: URL;
  try {
    url = relative ? new URL(raw, "http://scrub.invalid") : new URL(raw);
  } catch {
    // Not a URL, so its shape is unknown and it is more likely to be a
    // fragment of user input. Drop it rather than guess.
    return REDACTED;
  }

  let touched = false;
  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      url.searchParams.set(key, REDACTED);
      touched = true;
    }
  }
  if (!touched) return raw;
  return relative ? url.pathname + url.search : url.toString();
}

export function scrubHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    out[name] = SENSITIVE_HEADERS.has(name.toLowerCase()) ? REDACTED : value;
  }
  return out;
}

type ScrubbableEvent = {
  request?: {
    url?: string;
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
  };
  // Sentry types the id as string | number; this only ever reads it.
  user?: { id?: string | number; [key: string]: unknown };
};

/**
 * Last gate before an event is sent.
 *
 * The request body is dropped wholesale: form posts here carry passwords,
 * submitted work and real names, none of which belong in an error tracker. The
 * user is reduced to an id, which is enough to correlate reports without
 * shipping a name or an email address.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    event.request.headers = scrubHeaders(event.request.headers);
    delete event.request.cookies;
    delete event.request.data;
  }
  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : {};
  }
  return event;
}
