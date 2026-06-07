/**
 * Cloudflare Turnstile server-side verification
 * Docs: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerifyResult {
  success: boolean;
  errorCodes?: string[];
  hostname?: string;
}

export async function verifyTurnstile(
  token: string,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // CAPTCHA not configured (small private deploy / dev) — skip the check
    // rather than dead-locking signup. Set TURNSTILE_SECRET_KEY +
    // NEXT_PUBLIC_TURNSTILE_SITE_KEY to enforce it for public production.
    return { success: true, errorCodes: ["captcha-disabled"] };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
    ...(remoteIp ? { remoteip: remoteIp } : {}),
  });

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
      hostname?: string;
    };
    return {
      success: data.success,
      errorCodes: data["error-codes"],
      hostname: data.hostname,
    };
  } catch (err) {
    console.error("Turnstile verification failed:", err);
    return { success: false, errorCodes: ["network-error"] };
  }
}
