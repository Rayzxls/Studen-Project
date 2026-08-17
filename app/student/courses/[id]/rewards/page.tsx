import { notFound, redirect } from "next/navigation";
import { CircleCheck, Coins, Gift, History, ShieldCheck } from "lucide-react";

import { CourseShell } from "@/components/course/course-shell";
import { assert } from "@/lib/auth/guards";
import { getCourseOfferingForStudent } from "@/lib/course/queries";
import { getStudentCourseRewardDashboard } from "@/lib/reward/course-dashboard";
import { rewardEnabled } from "@/lib/reward/feature-flags";
import {
  formatRewardDateTime,
  rewardAchievementLabel,
} from "@/lib/reward/presentation";
import { studentCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

export default async function StudentCourseRewardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!rewardEnabled()) notFound();
  let guard;
  try {
    guard = await assert.isActiveCourseMember(id);
  } catch {
    redirect("/dashboard");
  }

  const [course, dashboard] = await Promise.all([
    getCourseOfferingForStudent(id, guard.session.user.id),
    getStudentCourseRewardDashboard({
      courseOfferingId: id,
      ctx: { actorUserId: guard.session.user.id },
    }),
  ]);
  if (!course) notFound();

  return (
    <CourseShell
      session={guard.session}
      course={course}
      eyebrow="ห้องเรียน"
      backHref="/dashboard"
      tabs={studentCourseTabs(id)}
    >
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-blue-50 shadow-card">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                แต้มของฉัน
              </span>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-black sm:text-2xl">
                ความพยายามทุกครั้งมีร่องรอย
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-black/55">
                ครูให้แต้มจากงาน การเข้าเรียน และผลงานในวิชานี้
                รายการเดิมจะไม่ถูกลบ แม้มีการแก้ไขภายหลัง
              </p>
            </div>
            <div className="flex min-w-44 items-center gap-3 rounded-3xl border border-amber-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Coins className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-medium text-black/45">ยอดคงเหลือ</p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-amber-800">
                  {dashboard.balance.toLocaleString("th-TH")}
                  <span className="ml-1 text-sm font-medium">แต้ม</span>
                </p>
              </div>
            </div>
          </div>
          <p className="flex items-start gap-2 border-t border-amber-200/60 bg-white/65 px-6 py-3 text-xs leading-relaxed text-blue-800 sm:px-8">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            หน้านี้เห็นได้เฉพาะเราและครูเจ้าของวิชา
            เพื่อนร่วมห้องมองไม่เห็นยอดแต้มของเรา
          </p>
        </section>

        <section
          className="card p-5 sm:p-6"
          aria-labelledby="reward-history-title"
        >
          <header className="flex items-center justify-between gap-3">
            <div>
              <h3
                id="reward-history-title"
                className="text-base font-semibold text-black"
              >
                ประวัติแต้ม
              </h3>
              <p className="mt-1 text-xs text-black/45">
                เรียงจากรายการล่าสุด · แสดงสูงสุด 50 รายการ
              </p>
            </div>
            <span className="rounded-full bg-black/[0.05] px-3 py-1 text-xs font-medium text-black/55">
              {dashboard.entries.length} รายการ
            </span>
          </header>

          {dashboard.entries.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-black/15 px-5 py-10 text-center">
              <History
                className="mx-auto h-9 w-9 text-black/20"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium text-black">
                ยังไม่มีรายการแต้มในวิชานี้
              </p>
              <p className="mt-1 text-xs text-black/45">
                เมื่อครูให้แต้ม รายการและเหตุผลจะปรากฏที่นี่ทันที
              </p>
            </div>
          ) : (
            <ol className="mt-4 divide-y divide-black/[0.06]">
              {dashboard.entries.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 py-4">
                  <span
                    className={
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full " +
                      (entry.amount > 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700")
                    }
                  >
                    {entry.amount > 0 ? (
                      <CircleCheck className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <History className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h4 className="text-sm font-semibold text-black">
                        {rewardAchievementLabel(entry.achievementType)}
                      </h4>
                      <span
                        className={
                          "text-base font-semibold tabular-nums " +
                          (entry.amount > 0
                            ? "text-emerald-700"
                            : "text-red-700")
                        }
                      >
                        {entry.amount > 0 ? "+" : ""}
                        {entry.amount.toLocaleString("th-TH")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-black/60">
                      {entry.reason ?? "ไม่มีข้อความเพิ่มเติม"}
                    </p>
                    <p className="mt-1.5 text-xs text-black/40">
                      {formatRewardDateTime(entry.createdAt)} น.
                      {entry.kind === "REVERSAL" ? " · รายการแก้ไข" : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </CourseShell>
  );
}
