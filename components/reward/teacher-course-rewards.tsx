import {
  ChevronDown,
  CircleCheck,
  Coins,
  History,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { UserAvatar } from "@/components/profile/user-avatar";
import { AwardRewardDialog } from "@/components/reward/award-reward-dialog";
import { ReverseRewardDialog } from "@/components/reward/reverse-reward-dialog";
import type { TeacherCourseRewardDashboard } from "@/lib/reward/course-dashboard";
import {
  formatRewardDateTime,
  rewardAchievementLabel,
} from "@/lib/reward/presentation";

export function TeacherCourseRewards({
  dashboard,
}: {
  dashboard: TeacherCourseRewardDashboard;
}) {
  const activityCount = dashboard.members.reduce(
    (sum, member) => sum + member.entries.length,
    0
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-blue-50 shadow-card">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              รางวัลรายวิชา
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-black">
              เห็นความพยายาม แล้วให้แต้มได้ทันเวลา
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-black/60">
              เลือกจากงานที่ส่ง การเข้าเรียน หรือคะแนนที่ประกาศแล้ว
              นักเรียนแต่ละคนเห็นเฉพาะยอดและประวัติของตัวเอง
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Metric
              icon={Coins}
              value={dashboard.totalBalance.toLocaleString("th-TH")}
              label="แต้มในห้อง"
            />
            <Metric
              icon={Users}
              value={`${dashboard.membersWithPoints}/${dashboard.members.length}`}
              label="มีแต้มแล้ว"
            />
            <Metric
              icon={History}
              value={activityCount.toLocaleString("th-TH")}
              label="รายการล่าสุด"
            />
          </div>
        </div>
        <div className="flex items-start gap-2 border-t border-amber-200/60 bg-white/65 px-5 py-3 text-xs leading-relaxed text-blue-800 sm:px-7">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          ยอดแต้มของนักเรียนทั้งห้องเห็นได้เฉพาะครูเจ้าของวิชา
          การให้และย้อนแต้มทุกครั้งมีประวัติและ audit
        </div>
      </section>

      {dashboard.members.length === 0 ? (
        <section className="card p-10 text-center">
          <Users className="mx-auto h-9 w-9 text-black/20" aria-hidden="true" />
          <h3 className="mt-3 text-base font-semibold text-black">
            ยังไม่มีนักเรียนในรายวิชานี้
          </h3>
          <p className="mt-1 text-sm text-black/50">
            เมื่อนักเรียนเข้าร่วม รายชื่อและผลงานที่ให้แต้มได้จะปรากฏที่นี่
          </p>
        </section>
      ) : (
        <section className="space-y-3" aria-labelledby="reward-members-title">
          <div className="flex items-center justify-between gap-3 px-1">
            <h3
              id="reward-members-title"
              className="text-base font-semibold text-black"
            >
              นักเรียน {dashboard.members.length} คน
            </h3>
            <p className="text-xs text-black/45">เรียงตามชื่อ</p>
          </div>

          {dashboard.members.map((member) => {
            const studentName = `${member.student.firstName} ${member.student.lastName}`;
            const availableCount = member.candidates.filter(
              (candidate) => !candidate.awarded
            ).length;
            return (
              <article
                key={member.enrollmentId}
                className="card overflow-hidden p-0"
              >
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar
                      userId={member.student.userId}
                      hasImage={member.student.profileImageId !== null}
                      version={member.student.profileImageId}
                      size={44}
                    />
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-black">
                        {studentName}
                      </h4>
                      <p className="mt-0.5 text-xs text-black/50">
                        {availableCount > 0
                          ? `มีผลงานใหม่ให้แต้มได้ ${availableCount} รายการ`
                          : "ยังไม่มีผลงานใหม่ที่ให้แต้มได้"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="rounded-2xl bg-amber-50 px-4 py-2 text-right ring-1 ring-amber-200/70">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-amber-800/70">
                        ยอดคงเหลือ
                      </p>
                      <p className="text-xl font-semibold tabular-nums text-amber-800">
                        {member.balance.toLocaleString("th-TH")}
                        <span className="ml-1 text-xs font-medium">แต้ม</span>
                      </p>
                    </div>
                    <AwardRewardDialog
                      courseId={dashboard.courseOfferingId}
                      enrollmentId={member.enrollmentId}
                      studentName={studentName}
                      candidates={member.candidates}
                    />
                  </div>
                </div>

                <details className="group border-t border-black/[0.06]">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-medium text-black/60 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <History className="h-4 w-4" aria-hidden="true" />
                      ประวัติแต้ม
                      <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px]">
                        {member.entries.length}
                      </span>
                    </span>
                    <ChevronDown
                      className="h-4 w-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="border-t border-black/[0.05] bg-slate-50/50 px-4 py-2 sm:px-5">
                    {member.entries.length === 0 ? (
                      <p className="py-5 text-center text-sm text-black/45">
                        ยังไม่มีรายการแต้ม
                      </p>
                    ) : (
                      <ul className="divide-y divide-black/[0.06]">
                        {member.entries.map((entry) => (
                          <li
                            key={entry.id}
                            className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
                          >
                            <span
                              className={
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full " +
                                (entry.amount > 0
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700")
                              }
                            >
                              {entry.amount > 0 ? (
                                <CircleCheck
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              ) : (
                                <History
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <p className="text-sm font-medium text-black">
                                  {rewardAchievementLabel(
                                    entry.achievementType
                                  )}
                                </p>
                                <span className="text-xs text-black/40">
                                  {formatRewardDateTime(entry.createdAt)} น.
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs leading-relaxed text-black/55">
                                {entry.reason ?? "ไม่มีข้อความเพิ่มเติม"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center justify-between gap-2 pl-10 sm:pl-0">
                              <span
                                className={
                                  "text-sm font-semibold tabular-nums " +
                                  (entry.amount > 0
                                    ? "text-emerald-700"
                                    : "text-red-700")
                                }
                              >
                                {entry.amount > 0 ? "+" : ""}
                                {entry.amount.toLocaleString("th-TH")}
                              </span>
                              {entry.kind === "AWARD" && entry.reversible && (
                                <ReverseRewardDialog
                                  courseId={dashboard.courseOfferingId}
                                  entryId={entry.id}
                                  points={entry.amount}
                                  studentName={studentName}
                                />
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Coins;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur-sm">
      <Icon className="h-4 w-4 text-blue-600" aria-hidden="true" />
      <p className="mt-2 text-lg font-semibold tabular-nums text-black sm:text-xl">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] leading-tight text-black/50 sm:text-xs">
        {label}
      </p>
    </div>
  );
}
