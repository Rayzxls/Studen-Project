import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { SignupStudentSchema } from "@/lib/validation/schemas";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { audit } from "@/lib/audit/log";
import { rateLimit } from "@/lib/auth/rate-limit";
import { getRequestMeta } from "@/lib/utils/request";
import {
  Conflict,
  errorResponse,
  TooManyRequests,
  ValidationError,
} from "@/lib/errors";

/**
 * POST /api/signup
 * Student self-registration
 *
 * Flow:
 *   1. Rate limit per IP (5/hour)
 *   2. Validate body (Zod)
 *   3. Verify Turnstile token
 *   4. Validate password strength
 *   5. Check studentId uniqueness
 *   6. Create User + Student (transaction)
 *   7. Audit STUDENT_SELF_REGISTERED
 *   8. Return success (client triggers signIn)
 */
export async function POST(req: Request) {
  const meta = await getRequestMeta();

  try {
    // ──── Rate limit ────
    const ipKey = meta.ipAddress ?? "unknown";
    const limit = await rateLimit({
      key: `signup:${ipKey}`,
      max: 5,
      windowSec: 3600,
      lockoutSec: 3600,
    });
    if (!limit.allowed) {
      throw new TooManyRequests(
        "signup_rate_limit_exceeded",
        Math.ceil((limit.lockedUntil!.getTime() - Date.now()) / 1000)
      );
    }

    // ──── Validate body ────
    const json = await req.json();
    const parsed = SignupStudentSchema.safeParse(json);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join(".");
        if (!errors[field]) errors[field] = issue.message;
      }
      throw new ValidationError(errors);
    }
    const body = parsed.data;

    // ──── Verify Turnstile ────
    const captcha = await verifyTurnstile(
      body.turnstileToken,
      meta.ipAddress ?? undefined
    );
    if (!captcha.success) {
      throw new ValidationError({
        turnstileToken: "ยืนยันตัวตนไม่ผ่าน กรุณาลองอีกครั้ง",
      });
    }

    // ──── Validate password strength ────
    const pwOk = validatePassword(body.password, "STUDENT");
    if (!pwOk.ok) {
      throw new ValidationError({ password: pwOk.reason });
    }

    // ──── Create User + Student ────
    const passwordHash = await hashPassword(body.password);

    try {
      const user = await db.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: {
            role: "STUDENT",
            identifier: body.studentId,
            passwordHash,
            mustResetPwd: false,
            consentedAt: new Date(),
            consentVersion: "1.0",
            student: {
              create: {
                studentId: body.studentId,
                firstName: body.firstName,
                lastName: body.lastName,
              },
            },
          },
          select: { id: true, role: true },
        });

        await audit(
          {
            actorId: u.id,
            actorRole: u.role,
            action: "STUDENT_SELF_REGISTERED",
            targetType: "User",
            targetId: u.id,
            ipAddress: meta.ipAddress ?? undefined,
            userAgent: meta.userAgent ?? undefined,
            after: {
              studentId: body.studentId,
              firstName: body.firstName,
              lastName: body.lastName,
            },
          },
          tx
        );

        await audit(
          {
            actorId: u.id,
            actorRole: u.role,
            action: "CONSENT_GRANTED",
            targetType: "User",
            targetId: u.id,
            ipAddress: meta.ipAddress ?? undefined,
            after: { version: "1.0" },
          },
          tx
        );

        return u;
      });

      return NextResponse.json(
        { success: true, userId: user.id },
        { status: 201 }
      );
    } catch (err) {
      // Handle unique constraint (studentId already exists)
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new Conflict("student_id_taken");
      }
      throw err;
    }
  } catch (err) {
    const { status, body } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
