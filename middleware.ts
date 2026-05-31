import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Secure headers + CSP baseline
 * ดู Security.md § 8 (Secure Headers)
 */
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? "'self' 'unsafe-inline' 'unsafe-eval'"
    : "'self' 'unsafe-inline'";

  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src ${scriptSrc} challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
      "img-src 'self' data: blob: *.r2.cloudflarestorage.com",
      "font-src 'self' data: fonts.gstatic.com",
      "connect-src 'self' *.neon.tech *.upstash.io *.r2.cloudflarestorage.com",
      "frame-src challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; ")
  );

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static, _next/image, favicon, public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)",
  ],
};
