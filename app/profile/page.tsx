import { redirect } from "next/navigation";
import { KeyRound, Palette, UserRound } from "lucide-react";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { resolveDisplayName } from "@/lib/profile/display-name";
import { DISPLAY_NAME_MAX } from "@/lib/profile/mutations";
import { TopNav } from "@/components/layout/top-nav";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { DisplayNameForm } from "@/components/profile/display-name-form";
import { ThemeModeControl } from "@/components/theme/theme-mode-control";

/**
 * /profile — Phase 13 · learning identity, not social media.
 *
 * Own-profile only; there is no public profile route for other users.
 * Deliberately absent: bio, followers, wall, course list, grades,
 * learning status, activity log, role badge. What remains is exactly
 * what a person manages about themselves: avatar, friendly display
 * name, read-only identity, theme (Batch 2), and password.
 */

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
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
      displayName: true,
      profileImageId: true,
      themeMode: true,
      admin: { select: { firstName: true, lastName: true } },
      teacher: { select: { firstName: true, lastName: true } },
      student: { select: { firstName: true, lastName: true } },
    },
  });
  if (!user) redirect("/login");

  const person = user.admin ?? user.teacher ?? user.student;
  const realName = person ? `${person.firstName} ${person.lastName}` : null;
  const friendly = resolveDisplayName({
    displayName: user.displayName,
    realName,
    identifier: user.identifier,
  });
  const identifierLabel =
    user.role === "STUDENT" ? "เลขประจำตัวนักเรียน" : "อีเมล";

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
              />
            </div>

            <div className="mt-6 border-t border-black/[0.06] pt-5">
              <DisplayNameForm
                initialDisplayName={user.displayName}
                maxLength={DISPLAY_NAME_MAX}
              />
            </div>

            <dl className="mt-6 grid gap-4 border-t border-black/[0.06] pt-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-black/50">
                  ชื่อจริง (แก้ไขไม่ได้)
                </dt>
                <dd className="mt-1 text-sm text-black">{realName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-black/50">
                  {identifierLabel} (แก้ไขไม่ได้)
                </dt>
                <dd className="mt-1 font-mono text-sm text-black">
                  {user.identifier}
                </dd>
              </div>
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
            <p className="mt-1 text-xs text-black/50">
              เปลี่ยนรหัสผ่านของบัญชีนี้ —
              อุปกรณ์อื่นที่ล็อกอินอยู่จะไม่ถูกตัดออก
            </p>
            <div className="mt-5">
              <ChangePasswordForm />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
