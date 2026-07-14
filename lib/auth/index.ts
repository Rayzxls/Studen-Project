import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { authConfig } from "@/lib/auth/config";
import { audit } from "@/lib/audit/log";
import { rateLimit } from "@/lib/auth/rate-limit";
import { getRequestMeta } from "@/lib/utils/request";
import { LoginSchema } from "@/lib/validation/schemas";
import { isAccountAvailableForAuthentication } from "@/lib/account/status";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Identifier", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { identifier, password } = parsed.data;

        const meta = await getRequestMeta();

        // Rate limit per identifier (separate IP-based limit could be added)
        const limit = await rateLimit({
          key: `login:${identifier.toLowerCase()}`,
          max: 5,
          windowSec: 900, // 15 min
          lockoutSec: 1800, // 30 min lock
        });
        if (!limit.allowed) {
          await audit({
            action: "USER_LOCKED",
            targetType: "User",
            targetId: identifier,
            reason: `Locked until ${limit.lockedUntil?.toISOString()}`,
            ipAddress: meta.ipAddress ?? undefined,
            userAgent: meta.userAgent ?? undefined,
          });
          return null;
        }

        const user = await db.user.findUnique({
          where: { identifier },
          select: {
            id: true,
            role: true,
            identifier: true,
            passwordHash: true,
            mustResetPwd: true,
            isActive: true,
            deletedAt: true,
          },
        });

        // Generic failure (no enumeration)
        if (
          !user ||
          !isAccountAvailableForAuthentication({
            isActive: user.isActive,
            deletedAt: user.deletedAt,
          })
        ) {
          await audit({
            action: "LOGIN_FAILED",
            targetType: "User",
            targetId: identifier,
            reason: "not_found_or_inactive",
            ipAddress: meta.ipAddress ?? undefined,
            userAgent: meta.userAgent ?? undefined,
          });
          return null;
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          await audit({
            actorId: user.id,
            actorRole: user.role,
            action: "LOGIN_FAILED",
            targetType: "User",
            targetId: user.id,
            reason: "wrong_password",
            ipAddress: meta.ipAddress ?? undefined,
            userAgent: meta.userAgent ?? undefined,
          });
          return null;
        }

        await audit({
          actorId: user.id,
          actorRole: user.role,
          action: "LOGIN_SUCCESS",
          targetType: "User",
          targetId: user.id,
          ipAddress: meta.ipAddress ?? undefined,
          userAgent: meta.userAgent ?? undefined,
        });

        return {
          id: user.id,
          role: user.role,
          identifier: user.identifier,
          mustResetPwd: user.mustResetPwd,
          name: user.identifier,
          email: null,
          image: null,
        };
      },
    }),
  ],
});
