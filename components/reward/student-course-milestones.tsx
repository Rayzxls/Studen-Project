import type { CourseRewardClaimStatus } from "@prisma/client";
import {
  CheckCircle2,
  Clock3,
  Gift,
  Lock,
  ShieldCheck,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";

import { ClaimCourseRewardButton } from "@/components/reward/course-milestone-actions";
import type {
  StudentCourseRewardMilestoneDashboard,
  StudentCourseRewardTierItem,
} from "@/lib/reward/course-milestones";
import { formatRewardDateTime } from "@/lib/reward/presentation";

export function StudentCourseMilestones({
  dashboard,
}: {
  dashboard: StudentCourseRewardMilestoneDashboard;
}) {
  const scorePercent = dashboard.score?.percent ?? 0;
  const claimableTier = dashboard.tiers.find(
    (tier) => tier.id === dashboard.claimableTierId
  );
  const pendingClaim = dashboard.claims.find(
    (claim) => claim.id === dashboard.pendingClaimId
  );
  const nextTier = dashboard.tiers.find(
    (tier) =>
      !tier.latestClaim &&
      tier.requiredScore > scorePercent &&
      tier.id !== dashboard.claimableTierId
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="card-featured overflow-hidden">
        <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_18rem] md:items-center md:p-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              เส้นทางรางวัลของฉัน
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-black sm:text-3xl">
              คะแนนที่ประกาศแล้ว พาเราเข้าใกล้รางวัลทุกขั้น
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/60">
              เมื่อคะแนนถึงเกณฑ์ ระบบจะเปิดรางวัลสูงสุดที่รับได้ให้กดขอ
              จากนั้นครูจะยืนยันเมื่อส่งมอบรางวัลแล้ว
            </p>
          </div>
          <div className="rounded-3xl bg-blue-50 p-5 text-blue-700">
            <p className="text-xs font-medium">คะแนนรวมที่ประกาศแล้ว</p>
            {dashboard.score ? (
              <>
                <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">
                  {formatScore(dashboard.score.percent)}
                </p>
                <p className="mt-1 text-xs">
                  {dashboard.score.earnedScore}/
                  {dashboard.score.publishedFullScore} คะแนน
                </p>
                <div
                  className="mt-4 h-2 overflow-hidden rounded-full bg-black/10"
                  role="progressbar"
                  aria-label="คะแนนรวมของวิชา"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(dashboard.score.percent)}
                >
                  <div
                    className="h-full rounded-full bg-blue-500 transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${clamp(dashboard.score.percent)}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm font-medium">ยังไม่มีคะแนนที่ประกาศ</p>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2 border-t border-black/[0.06] bg-blue-50 px-6 py-3 text-xs leading-relaxed text-blue-700 md:px-8">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          คะแนนและประวัติรับรางวัลหน้านี้เห็นได้เฉพาะเราและครูเจ้าของวิชา
          เพื่อนร่วมห้องมองไม่เห็น
        </div>
      </section>

      {(claimableTier || pendingClaim || nextTier) && (
        <section
          className="card p-5 sm:p-6"
          aria-labelledby="reward-next-step-title"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                {pendingClaim ? (
                  <Clock3 className="h-5 w-5" aria-hidden="true" />
                ) : claimableTier ? (
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Trophy className="h-5 w-5" aria-hidden="true" />
                )}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  ขั้นต่อไป
                </p>
                <h3
                  id="reward-next-step-title"
                  className="mt-1 font-semibold text-black"
                >
                  {pendingClaim
                    ? `รอครูส่งมอบ “${pendingClaim.snapshotTierTitle}”`
                    : claimableTier
                      ? `รับได้แล้ว: ${claimableTier.title}`
                      : nextTier
                        ? `อีก ${formatGap(nextTier.requiredScore - scorePercent)} ถึง “${nextTier.title}”`
                        : "ไปต่ออีกนิด"}
                </h3>
                <p className="mt-1 text-sm text-black/55">
                  {pendingClaim
                    ? "ส่งคำขอแล้ว ครูจะอัปเดตสถานะในหน้านี้เมื่อดำเนินการ"
                    : claimableTier
                      ? `คะแนนถึงเกณฑ์ ${claimableTier.requiredScore}% แล้ว ระบบจะส่งเฉพาะรางวัลสูงสุดที่รับได้`
                      : "คะแนนจะอัปเดตอัตโนมัติเมื่อครูประกาศรายการใหม่"}
                </p>
              </div>
            </div>
            {claimableTier && !pendingClaim && (
              <div className="shrink-0">
                <ClaimCourseRewardButton
                  courseId={dashboard.courseOfferingId}
                  enrollmentId={dashboard.enrollmentId}
                />
              </div>
            )}
          </div>
        </section>
      )}

      <section className="card p-5 sm:p-6" aria-labelledby="reward-path-title">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Milestones
            </p>
            <h3
              id="reward-path-title"
              className="mt-1 text-lg font-semibold text-black"
            >
              รางวัลทั้งหมดในวิชานี้
            </h3>
          </div>
          <p className="text-xs text-black/45">เรียงจากเกณฑ์น้อยไปมาก</p>
        </header>

        {dashboard.tiers.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-black/[0.12] p-8 text-center">
            <Gift
              className="mx-auto h-8 w-8 text-black/20"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-semibold text-black">
              ครูยังไม่ได้ตั้งรางวัล
            </p>
            <p className="mt-1 text-xs text-black/50">
              เมื่อครูเพิ่มเกณฑ์รางวัล เส้นทางจะปรากฏที่นี่โดยอัตโนมัติ
            </p>
          </div>
        ) : (
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {dashboard.tiers.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                scorePercent={scorePercent}
                claimable={tier.id === dashboard.claimableTierId}
              />
            ))}
          </ol>
        )}
      </section>

      {dashboard.claims.length > 0 && (
        <section
          className="card p-5 sm:p-6"
          aria-labelledby="claim-history-title"
        >
          <h3
            id="claim-history-title"
            className="text-base font-semibold text-black"
          >
            ประวัติคำขอของฉัน
          </h3>
          <ul className="mt-3 divide-y divide-black/[0.06]">
            {dashboard.claims.map((claim) => (
              <li
                key={claim.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-black">
                    {claim.snapshotTierTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-black/45">
                    คะแนนตอนขอ {formatScore(claim.snapshotScorePercent)}
                    {claim.requestedAt
                      ? ` · ${formatRewardDateTime(claim.requestedAt)} น.`
                      : ""}
                    {claim.resolutionReason
                      ? ` · ${claim.resolutionReason}`
                      : ""}
                  </p>
                </div>
                <ClaimStatus status={claim.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TierCard({
  tier,
  scorePercent,
  claimable,
}: {
  tier: StudentCourseRewardTierItem;
  scorePercent: number;
  claimable: boolean;
}) {
  const reached = scorePercent >= tier.requiredScore;
  const status = tier.latestClaim?.status;
  const Icon =
    status === "FULFILLED"
      ? CheckCircle2
      : status === "PENDING"
        ? Clock3
        : status === "REJECTED"
          ? XCircle
          : reached
            ? Trophy
            : Lock;

  return (
    <li
      className={
        "rounded-2xl border p-4 transition-colors " +
        (claimable
          ? "border-blue-500 bg-blue-50"
          : reached
            ? "border-black/[0.08]"
            : "border-black/[0.06] opacity-75")
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={
            "grid h-11 w-11 shrink-0 place-items-center rounded-2xl " +
            (reached
              ? "bg-blue-50 text-blue-700"
              : "bg-black/[0.04] text-black/35")
          }
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-black">{tier.title}</h4>
            <span className="shrink-0 rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-semibold tabular-nums text-black/60">
              {tier.requiredScore}%
            </span>
          </div>
          <p className="mt-1 text-sm leading-5 text-black/55">
            {tier.description ?? "ไม่มีรายละเอียดเพิ่มเติม"}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <span className="text-black/45">
              {reached
                ? "ถึงเกณฑ์แล้ว"
                : `เหลือ ${formatGap(tier.requiredScore - scorePercent)}`}
            </span>
            {claimable ? (
              <span className="font-semibold text-blue-700">รับได้ตอนนี้</span>
            ) : status ? (
              <ClaimStatus status={status} />
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

function ClaimStatus({ status }: { status: CourseRewardClaimStatus }) {
  const styles = {
    PENDING: "bg-orange-50 text-orange-700",
    FULFILLED: "bg-green-50 text-green-700",
    REJECTED: "bg-red-50 text-red-700",
    SUPERSEDED: "bg-black/[0.04] text-black/50",
  } as const;
  const labels = {
    PENDING: "รอครูดำเนินการ",
    FULFILLED: "รับแล้ว",
    REJECTED: "ถูกปฏิเสธ",
    SUPERSEDED: "ข้ามไปรางวัลที่สูงกว่า",
  } as const;
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

function formatScore(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

function formatGap(value: number) {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}
