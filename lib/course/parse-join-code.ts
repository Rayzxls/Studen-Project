/**
 * PURE — turn a decoded QR payload into a class code, or null.
 *
 * The teacher card encodes the absolute invite URL
 * (`https://<app>/join?code=XXX`), but students may also point the scanner
 * at older printouts or hand-written codes rendered as bare-text QRs, so
 * both shapes are accepted. Anything else (foreign URLs, random text) is
 * rejected — the scanner must never navigate to arbitrary content.
 */

/** Mirrors the class-code alphabet used by lib/course/class-code.ts. */
const CLASS_CODE_RE = /^[A-Z0-9][A-Z0-9-]{2,30}$/;

export function parseJoinCode(payload: string): string | null {
  const text = payload.trim();
  if (!text) return null;

  // Invite-URL shape — accept ONLY the code param, never the URL itself.
  if (/^https?:\/\//i.test(text)) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (!url.pathname.endsWith("/join")) return null;
    const code = (url.searchParams.get("code") ?? "").trim().toUpperCase();
    return CLASS_CODE_RE.test(code) ? code : null;
  }

  // Bare-code shape.
  const code = text.toUpperCase();
  return CLASS_CODE_RE.test(code) ? code : null;
}
