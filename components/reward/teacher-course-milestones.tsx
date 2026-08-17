import {
  CheckCircle2,
  Clock3,
  Gift,
  ListChecks,
  Medal,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import {
  ArchiveCourseRewardTierButton,
  CourseRewardTierForm,
  ResolveCourseRewardClaim,
} from "@/components/reward/course-milestone-actions";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { TeacherCourseRewardMilestoneDashboard } from "@/lib/reward/course-milestones";
import { formatRewardDateTime } from "@/lib/reward/presentation";

export function TeacherCourseMilestones({
  dashboard,
}: {
  dashboard: TeacherCourseRewardMilestoneDashboard;
}) {
  const fulfilledCount = dashboard.recentClaims.filter(
    (claim) => claim.status === "FULFILLED"
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="card-featured overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)] lg:items-end lg:p-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              รางวัลจากคะแนนจริง
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-black sm:text-3xl">
              ตั้งหมุดหมาย แล้วให้นักเรียนเห็นว่าความพยายามพาไปถึงไหน
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">
              ระบบคำนวณจากคะแนนรวมที่ประกาศแล้วของวิชานี้
              นักเรียนส่งคำขอได้เฉพาะรางวัลสูงสุดที่ตนเองถึง
              และเห็นเฉพาะข้อมูลของตัวเอง
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Metric
              label="เกณฑ์รางวัล"
              value={dashboard.tiers.length}
              icon={Medal}
            />
            <Metric
              label="รอดำเนินการ"
              value={dashboard.pendingClaims.length}
              icon={Clock3}
            />
            <Metric
              label="ส่งมอบล่าสุด"
              value={fulfilledCount}
              icon={CheckCircle2}
            />
          </div>
        </div>
        <div className="flex items-start gap-2 border-t border-black/[0.06] bg-blue-50 px-6 py-3 text-xs leading-relaxed text-blue-700 lg:px-8">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          คะแนนถูกตรวจซ้ำบนเซิร์ฟเวอร์ทุกครั้งที่นักเรียนกดรับ
          และทุกการแก้ไขเกณฑ์หรือดำเนินคำขอมีประวัติ audit
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section
          className="card p-5 sm:p-6"
          aria-labelledby="create-tier-title"
        >
          <header className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              ตั้งค่ารายวิชา
            </p>
            <h3
              id="create-tier-title"
              className="mt-1 text-lg font-semibold text-black"
            >
              เพิ่มเกณฑ์และของรางวัล
            </h3>
            <p className="mt-1 text-sm text-black/55">
              หนึ่งช่วงคะแนนมีได้หนึ่งรางวัล เกณฑ์คิดเป็นเปอร์เซ็นต์ 0–100
            </p>
          </header>
          <CourseRewardTierForm courseId={dashboard.courseOfferingId} />
        </section>

        <section
          className="card p-5 sm:p-6"
          aria-labelledby="pending-claims-title"
        >
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                กล่องคำขอ
              </p>
              <h3
                id="pending-claims-title"
                className="mt-1 text-lg font-semibold text-black"
              >
                รอส่งมอบ {dashboard.pendingClaims.length} รายการ
              </h3>
            </div>
            <ListChecks className="h-5 w-5 text-black/35" aria-hidden="true" />
          </header>

          {dashboard.pendingClaims.length === 0 ? (
            <EmptyPanel
              icon={CheckCircle2}
              title="ไม่มีคำขอค้าง"
              description="เมื่อนักเรียนถึงเกณฑ์และกดรับ คำขอจะมาอยู่ตรงนี้"
            />
          ) : (
            <ul className="mt-4 space-y-3">
              {dashboard.pendingClaims.map((claim) => {
                const studentName = `${claim.student.firstName} ${claim.student.lastName}`;
                return (
                  <li
                    key={claim.id}
                    className="rounded-2xl border border-black/[0.06] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        userId={claim.student.userId}
                        hasImage={claim.student.profileImageId !== null}
                        version={claim.student.profileImageId}
                        size={40}
                        alt={studentName}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-black">
                              {studentName}
                            </p>
                            <p className="mt-0.5 text-sm text-black/60">
                              {claim.snapshotTierTitle} · เกณฑ์{" "}
                              {claim.snapshotTierRequiredScore}%
                            </p>
                          </div>
                          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                            คะแนนตอนขอ {formatScore(claim.snapshotScorePercent)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-black/45">
                          {claim.snapshotEarnedScore}/
                          {claim.snapshotPublishedFullScore} คะแนนที่ประกาศแล้ว
                          {claim.requestedAt
                            ? ` · ขอเมื่อ ${formatRewardDateTime(claim.requestedAt)} น.`
                            : ""}
                        </p>
                        {claim.snapshotTierFulfillmentInstructions && (
                          <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-700">
                            วิธีส่งมอบ:{" "}
                            {claim.snapshotTierFulfillmentInstructions}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 border-t border-black/[0.06] pt-3">
                      <ResolveCourseRewardClaim
                        courseId={dashboard.courseOfferingId}
                        claimId={claim.id}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-5 sm:p-6" aria-labelledby="tier-list-title">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              เส้นทางรางวัล
            </p>
            <h3
              id="tier-list-title"
              className="mt-1 text-lg font-semibold text-black"
            >
              เกณฑ์ที่นักเรียนมองเห็น
            </h3>
          </div>
          <p className="text-xs text-black/45">เรียงจากคะแนนน้อยไปมาก</p>
        </header>

        {dashboard.tiers.length === 0 ? (
          <EmptyPanel
            icon={Gift}
            title="ยังไม่มีรางวัลในวิชานี้"
            description="เพิ่มรางวัลแรกจากแบบฟอร์มด้านบน นักเรียนจึงจะเห็นเส้นทางรางวัล"
          />
        ) : (
          <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.tiers.map((tier, index) => (
              <li
                key={tier.id}
                className="rounded-2xl border border-black/[0.06] p-4 transition-colors hover:border-blue-500/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-lg font-semibold tabular-nums text-blue-700">
                    {tier.requiredScore}%
                  </span>
                  <span className="text-xs text-black/40">
                    ลำดับ {index + 1}
                  </span>
                </div>
                <h4 className="mt-4 font-semibold text-black">{tier.title}</h4>
                <p className="mt-1 min-h-10 text-sm leading-5 text-black/55">
                  {tier.description ?? "ไม่มีรายละเอียดเพิ่มเติม"}
                </p>
                {tier.fulfillmentInstructions && (
                  <p className="mt-3 text-xs leading-relaxed text-black/50">
                    วิธีรับ: {tier.fulfillmentInstructions}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-start justify-between gap-2 border-t border-black/[0.06] pt-3">
                  <CourseRewardTierForm
                    courseId={dashboard.courseOfferingId}
                    tier={tier}
                  />
                  <ArchiveCourseRewardTierButton
                    courseId={dashboard.courseOfferingId}
                    tier={tier}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {dashboard.recentClaims.length > 0 && (
        <section
          className="card p-5 sm:p-6"
          aria-labelledby="recent-claims-title"
        >
          <h3
            id="recent-claims-title"
            className="text-base font-semibold text-black"
          >
            ประวัติดำเนินการล่าสุด
          </h3>
          <ul className="mt-3 divide-y divide-black/[0.06]">
            {dashboard.recentClaims.map((claim) => (
              <li
                key={claim.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-black">
                    {claim.student.firstName} {claim.student.lastName} ·{" "}
                    {claim.snapshotTierTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-black/45">
                    {claim.resolvedAt
                      ? `${formatRewardDateTime(claim.resolvedAt)} น.`
                      : "—"}
                    {claim.resolutionReason
                      ? ` · ${claim.resolutionReason}`
                      : ""}
                  </p>
                </div>
                <span
                  className={
                    claim.status === "FULFILLED"
                      ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
                      : "rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                  }
                >
                  {claim.status === "FULFILLED" ? "ส่งมอบแล้ว" : "ปฏิเสธ"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Medal;
}) {
  return (
    <div className="panel-inset min-w-0 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-blue-700" aria-hidden="true" />
      <p className="mt-1 text-xl font-semibold tabular-nums text-black">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-black/50">{label}</p>
    </div>
  );
}

function EmptyPanel({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Gift;
  title: string;
  description: string;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-black/[0.12] px-5 py-8 text-center">
      <Icon className="mx-auto h-8 w-8 text-black/20" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-black">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-black/50">
        {description}
      </p>
    </div>
  );
}

function formatScore(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}
