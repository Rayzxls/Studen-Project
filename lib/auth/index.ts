import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { authConfig } from "@/lib/auth/config";
import { audit } from "@/lib/audit/log";
import { rateLimit } from "@/lib/auth/rate-limit";

const LoginSchema = z.object({
  identifier: z.string().min(3).max(254),
  password: z.string().min(1).max(200),
});

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

        // Rate limit per identifier+IP (IP added in API; here just identifier)
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
        if (!user || !user.isActive || user.deletedAt) {
          await audit({
            action: "LOGIN_FAILED",
            targetType: "User",
            targetId: identifier,
            reason: "not_found_or_inactive",
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
          });
          return null;
        }

        await audit({
          actorId: user.id,
          actorRole: user.role,
          action: "LOGIN_SUCCESS",
          targetType: "User",
          targetId: user.id,
        });

        return {
          id: user.id,
          role: user.role,
          identifier: user.identifier,
          mustResetPwd: user.mustResetPwd,
          // Required by Auth.js User type
          name: user.identifier,
          email: null,
          image: null,
        };
      },
    }),
  ],
});
