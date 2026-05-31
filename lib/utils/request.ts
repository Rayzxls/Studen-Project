import { headers } from "next/headers";

/**
 * Extract IP + User-Agent from request — for audit logging
 * Use ใน Server Action / Route Handler / Server Component
 */
export async function getRequestMeta(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  // Vercel / Cloudflare provide IP via these headers
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    h.get("cf-connecting-ip") ??
    null;
  const ua = h.get("user-agent") ?? null;
  return { ipAddress: ip, userAgent: ua };
}
