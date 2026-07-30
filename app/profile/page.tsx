import { redirect } from "next/navigation";
import {
  AtSign,
  KeyRound,
  Link2,
  Palette,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { resolveAccountName } from "@/lib/profile/account-name";
import { identityFoundationMutationsEnabled } from "@/lib/identity/feature-flags";
import { DISABLED_COMPATIBILITY_PASSWORD_HASH } from "@/lib/identity/foundation";
import { TopNav } from "@/components/layout/top-nav";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { DeleteAccountForm } from "@/components/profile/delete-account-form";
import { SetFallbackPasswordForm } from "@/components/profile/set-fallback-password-form";
import { ChangeEmailForm } from "@/components/profile/change-email-form";
import { ThemeModeControl } from "@/components/theme/theme-mode-control";
import { startGoogleLinkAction } from "./actions";

/** Feedback for the Google-link round-trip, keyed by the `?linked=` status. */
const LINK_STATUS: Record<string, { ok: boolean; text: string }> = {
  "1": {
    ok: true,
    text: "เชื่อมต่อ Google สำเร็จ — ใช้ Google เข้าสู่ระบบได้แล้ว",
  },
  already: { ok: true, text: "บัญชีนี้เชื่อมต่อ Google อยู่แล้ว" },
  has_google: { ok: true, text: "บัญชีนี้มีการเชื่อมต่อ Google อยู่แล้ว" },
  reauth: {
    ok: false,
    text: "เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่ แล้วลองอีกครั้งภายใน 20 นาที",
  },
  mismatch: {
    ok: false,
    text: "อีเมล Google ไม่ตรงกับอีเมลของบัญชี — เปลี่ยนอีเมลให้ตรงกันก่อน",
  },
  taken: {
    ok: false,
    text: "บัญชี Google นี้ถูกเชื่อมกับผู้ใช้อื่นแล้ว",
  },
  error: { ok: false, text: "เชื่อมต่อ Google ไม่สำเร็จ กรุณาลองใหม่" },
};

/**
 * /profile — Phase 13 · learning identity, not social media.
 *
 * Own-profile only; there is no public profile route for other users.
 * Deliberately absent: bio, followers, wall, course list, grades,
 * learning status, activity log, role badge. What remains is exactly
 * what a person manages about themselves: avatar, read-only identity,
 * theme, and password.
 */

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ linked?: string }>;
}) {
  let session;
  try {
    session = await requireAuth();
  } catch {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      identifier: true,
      profileImageId: true,
      themeMode: true,
      passwordHash: true,
      email: true,
      authIdentities: {
        where: { provider: "GOOGLE" },
        take: 1,
        select: { id: true },
      },
      admin: { select: { firstName: true, lastName: true } },
      teacher: { select: { firstName: true, lastName: true } },
      student: { select: { firstName: true, lastName: true } },
    },
  });
  if (!user) redirect("/login");

  const linkStatus = LINK_STATUS[(await searchParams).linked ?? ""] ?? null;

  // A Google-first account carries the disabled compatibility hash until it
  // sets an optional fallback password. Only then, and only while the identity
  // feature is enabled, is the "set" form offered instead of "change".
  const hasFallbackPassword =
    user.passwordHash !== DISABLED_COMPATIBILITY_PASSWORD_HASH;
  const offerFallbackSetup =
    identityFoundationMutationsEnabled() && !hasFallbackPassword;

  // The same verified-link flow both changes an existing email and sets the
  // first one. A username-only account (the emergency owner, or a
  // compatibility-era row) otherwise has no way to reach email recovery or
  // Google linking, since both require an address on the account.
  const offerEmailChange = identityFoundationMutationsEnabled();

  // Linking Google is offered to an account that has an email (required to match
  // the Google address) and no Google identity yet — typically a password-era
  // Teacher or Admin adding Google sign-in.
  const hasGoogleIdentity = user.authIdentities.length > 0;

  const person = user.admin ?? user.teacher ?? user.student;
  const realName = person ? `${person.firstName} ${person.lastName}` : null;
  const friendly = resolveAccountName({
    realName,
    identifier: user.identifier,
  });
  const visibleEmail =
    user.email ?? (user.role === "STUDENT" ? null : user.identifier);

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={session} maxWidth="max-w-4xl" />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1
          className="text-2xl font-semibold text-black sm:text-3xl"
          style={{ letterSpacing: "-0.03em" }}
        >
          โปรไฟล์ของ {friendly}
        </h1>
        <p className="mt-1 text-sm text-black/55">
          ข้อมูลส่วนตัวสำหรับการเรียนการสอน —
          เพื่อนร่วมห้องเห็นเฉพาะชื่อจริงของคุณ
        </p>

        <div className="mt-6 space-y-4">
          {/* Identity — avatar + names */}
          <section className="card p-6">
            <h2
              className="flex items-center gap-2 text-base font-semibold text-black"
              style={{ letterSpacing: "-0.01em" }}
            >
              <UserRound className="h-4 w-4 text-black/40" aria-hidden="true" />
              ข้อมูลของฉัน
            </h2>

            <div className="mt-5">
              <AvatarEditor
                userId={user.id}
                hasImage={user.profileImageId !== null}
                version={user.profileImageId}
              />
            </div>

            <dl
              className={`mt-6 grid gap-4 border-t border-black/[0.06] pt-5 ${
                visibleEmail ? "sm:grid-cols-2" : ""
              }`}
            >
              <div>
                <dt className="text-xs font-medium text-black/50">
                  ชื่อจริง (แก้ไขไม่ได้)
                </dt>
                <dd className="mt-1 text-sm text-black">{realName ?? "—"}</dd>
              </div>
              {visibleEmail && (
                <div>
                  <dt className="text-xs font-medium text-black/50">
                    อีเมลที่ใช้กับบัญชี
                  </dt>
                  <dd className="mt-1 text-sm text-black">{visibleEmail}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Theme — Batch 2 lands the real segmented control here. */}
          <section className="card p-6">
            <h2
              className="flex items-center gap-2 text-base font-semibold text-black"
              style={{ letterSpacing: "-0.01em" }}
            >
              <Palette className="h-4 w-4 text-black/40" aria-hidden="true" />
              ธีม
            </h2>
            <p className="mt-1 text-xs text-black/50">
              เลือกโหมดการแสดงผลของทั้งระบบ
            </p>
            <div className="mt-4">
              <ThemeModeControl initialMode={user.themeMode} />
            </div>
            <div className="hidden" aria-disabled="true">
              {["ตามระบบ", "สว่าง", "มืด"].map((label, i) => (
                <span
                  key={label}
                  className={
                    "cursor-not-allowed rounded-full px-4 py-1.5 text-xs font-medium " +
                    (i === 0
                      ? "bg-white text-black shadow-card"
                      : "text-black/40")
                  }
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="hidden">เร็ว ๆ นี้ — โหมดมืดกำลังมา</p>
          </section>

          {/* Security */}
          <section className="card p-6">
            <h2
              className="flex items-center gap-2 text-base font-semibold text-black"
              style={{ letterSpacing: "-0.01em" }}
            >
              <KeyRound className="h-4 w-4 text-black/40" aria-hidden="true" />
              ความปลอดภัย
            </h2>
            {offerFallbackSetup ? (
              <>
                <div className="mt-4 flex gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-900">
                  <TriangleAlert
                    className="mt-0.5 h-5 w-5 shrink-0 text-orange-600"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      เพิ่มช่องทางสำรองสำหรับบัญชี
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-orange-800">
                      บัญชีนี้เข้าสู่ระบบด้วย Google และยังไม่มีรหัสผ่านสำรอง
                      ระบบกู้บัญชีพร้อมใช้งานแล้ว
                      แต่จะส่งลิงก์กู้รหัสผ่านให้บัญชีที่ตั้งรหัสผ่านสำรองไว้เท่านั้น
                      คุณยังใช้ Google เข้าสู่ระบบได้ตามปกติ
                    </p>
                  </div>
                </div>
                <div className="mt-5">
                  <SetFallbackPasswordForm />
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-xs text-black/50">
                  เปลี่ยนรหัสผ่านของบัญชีนี้ —
                  อุปกรณ์อื่นที่ล็อกอินอยู่จะไม่ถูกตัดออก
                </p>
                <div className="mt-5">
                  <ChangePasswordForm />
                </div>
              </>
            )}
          </section>

          {/* Verified-email change and first-time email setup (Release D),
              flag-gated. */}
          {offerEmailChange && (
            <section className="card p-6">
              <h2
                className="flex items-center gap-2 text-base font-semibold text-black"
                style={{ letterSpacing: "-0.01em" }}
              >
                <AtSign className="h-4 w-4 text-black/40" aria-hidden="true" />
                อีเมล
              </h2>
              <p className="mt-1 text-xs text-black/50">
                {user.email
                  ? "เปลี่ยนอีเมลของบัญชี — ต้องยืนยันผ่านลิงก์ที่ส่งไปอีเมลใหม่ และอุปกรณ์อื่นจะถูกออกจากระบบ"
                  : "บัญชีนี้ยังไม่มีอีเมล — ตั้งอีเมลเพื่อใช้กู้รหัสผ่านและเชื่อมต่อ Google โดยยืนยันผ่านลิงก์ที่ส่งไปอีเมลนั้น"}
              </p>
              <div className="mt-5">
                <ChangeEmailForm currentEmail={user.email} />
              </div>
            </section>
          )}

          {/* Account connection — link Google (E²), flag-gated. */}
          {identityFoundationMutationsEnabled() && (
            <section className="card p-6">
              <h2
                className="flex items-center gap-2 text-base font-semibold text-black"
                style={{ letterSpacing: "-0.01em" }}
              >
                <Link2 className="h-4 w-4 text-black/40" aria-hidden="true" />
                การเข้าสู่ระบบด้วย Google
              </h2>

              {linkStatus && (
                <div
                  className={
                    "mt-3 rounded-xl px-3 py-2 text-sm " +
                    (linkStatus.ok
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700")
                  }
                >
                  {linkStatus.text}
                </div>
              )}

              {hasGoogleIdentity ? (
                <p className="mt-3 text-sm text-black/60">
                  บัญชีนี้เชื่อมต่อกับ Google แล้ว — เข้าสู่ระบบได้ทั้ง Google
                  และรหัสผ่าน
                </p>
              ) : !user.email ? (
                <p className="mt-3 text-sm text-black/60">
                  ต้องตั้งอีเมลของบัญชีก่อน เพราะการเชื่อมต่อต้องใช้บัญชี Google
                  ที่มีอีเมลตรงกัน — ตั้งได้ที่หัวข้อ &ldquo;อีเมล&rdquo; ด้านบน
                </p>
              ) : (
                <>
                  <p className="mt-1 text-xs text-black/50">
                    เชื่อม Google เข้ากับบัญชีนี้เพื่อเข้าสู่ระบบด้วย Google ได้
                    — ต้องใช้บัญชี Google ที่มีอีเมลตรงกับ{" "}
                    <span className="font-medium text-black/70">
                      {user.email}
                    </span>
                  </p>
                  <form action={startGoogleLinkAction} className="mt-4">
                    <button
                      type="submit"
                      className="btn-secondary btn-sm gap-2"
                    >
                      เชื่อมต่อ Google
                    </button>
                  </form>
                </>
              )}
            </section>
          )}

          {/* Danger zone — self-service deletion (D1), flag-gated. */}
          {identityFoundationMutationsEnabled() && (
            <section className="card border-red-200 p-6">
              <h2
                className="flex items-center gap-2 text-base font-semibold text-red-700"
                style={{ letterSpacing: "-0.01em" }}
              >
                <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                ลบบัญชี
              </h2>
              <div className="mt-4">
                <DeleteAccountForm />
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
