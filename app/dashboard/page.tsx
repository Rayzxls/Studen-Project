import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, GraduationCap, Plus } from "lucide-react";
import type { Session } from "@/lib/auth/permissions";
import { auth } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/profile/display-name";
import { UserAvatar } from "@/components/profile/user-avatar";
import { db } from "@/lib/db/client";
import { listStudentCourses } from "@/lib/course/enrollment";
import { currentTerm } from "@/lib/dashboard/queries";
import {
  getStudentActionCenter,
  getTeacherClassHealth,
  getTeacherReviewQueue,
} from "@/lib/dashboard/action-center";
import { TopNav } from "@/components/layout/top-nav";
import { StudentBottomNav } from "@/components/layout/student-bottom-nav";
import { StudentTodayPanel } from "@/components/dashboard/student-today-panel";
import { TeacherHero } from "@/components/dashboard/teacher-hero";
import {
  CourseShowcaseCard,
  CourseShowcaseEmpty,
} from "@/components/dashboard/primitives";
import {
  StudentCourseCardMenu,
  TeacherCourseCardMenu,
} from "@/components/course/course-card-menu";
import {
  DueWorkBlock,
  RecentScoresBlock,
  ReturnedWorkBlock,
} from "@/components/dashboard/student-action-center";
import {
  ClassHealthBlock,
  ReviewQueueBlock,
} from "@/components/dashboard/teacher-ops";
import { AmbientBackground } from "@/components/motion/ambient-background";
import {
  DashboardFocusBrief,
  DashboardOperatingGrid,
  DashboardSectionHeading,
} from "@/components/dashboard/operating-shell";
import { moderationCenterEnabled } from "@/lib/moderation/feature-flags";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

/**
 * Role-aware dashboard — Phase 11 reshape.
 *
 * Each role lands on an operating dashboard, not a feed:
 *   Student — "วันนี้ต้องจัดการอะไร": returned work, due work, today's
 *             classes, fresh scores, course quick access.
 *   Teacher — "ห้องไหนต้องดูแลตอนนี้": review queue, attendance today,
 *             class health.
 *   Admin   — redirects straight to /admin/dashboard, the real operating
 *             surface with sidebar + system overview.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "ADMIN") redirect("/admin/dashboard");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      identifier: true,
      displayName: true,
      profileImageId: true,
      teacher: {
        select: {
          firstName: true,
          lastName: true,
          homeroomOf: { select: { name: true } },
        },
      },
      student: {
        select: {
          firstName: true,
          lastName: true,
          class: { select: { name: true } },
        },
      },
    },
  });
  if (!user) redirect("/login");

  const realName = user.teacher
    ? `${user.teacher.firstName} ${user.teacher.lastName}`
    : user.student
      ? `${user.student.firstName} ${user.student.lastName}`
      : null;
  // Friendly greeting only — every shared surface keeps the real name.
  const name = resolveDisplayName({
    displayName: user.displayName,
    realName,
    identifier: user.identifier,
  });
  const hasAvatar = user.profileImageId !== null;

  return (
    <div className="min-h-screen bg-bg">
      <TopNav
        session={session}
        maxWidth="max-w-[1480px]"
        accountLabel={name}
        accountSubtitle={user.role === "TEACHER" ? "ครูผู้สอน" : "นักเรียน"}
      />

      <main className="mx-auto max-w-[1480px] animate-fade-in px-4 py-8 sm:px-6 md:py-10">
        {user.role === "STUDENT" && (
          <StudentDashboard
            session={session}
            name={name}
            hasAvatar={hasAvatar}
            avatarVersion={user.profileImageId}
            className={user.student?.class?.name ?? null}
          />
        )}

        {user.role === "TEACHER" && (
          <TeacherDashboard
            teacherUserId={session.user.id}
            name={name}
            hasAvatar={hasAvatar}
            avatarVersion={user.profileImageId}
            homeroomName={user.teacher?.homeroomOf?.name ?? null}
          />
        )}

        {(user.role === "STUDENT" || user.role === "TEACHER") && (
          <div className="h-20 md:hidden" />
        )}
      </main>

      {(user.role === "STUDENT" || user.role === "TEACHER") && (
        <StudentBottomNav
          role={user.role === "TEACHER" ? "teacher" : "student"}
        />
      )}
    </div>
  );
}

function countBy<T>(
  items: T[],
  getKey: (item: T) => string
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function yearLabelFromTerm(termName?: string | null): string | undefined {
  if (!termName) return undefined;
  const year = termName.match(/\d{4}/)?.[0];
  return year ? `ปี ${year}` : termName;
}

// ─────────────────────────────────────────────────────────────
// Student
// ─────────────────────────────────────────────────────────────

async function StudentDashboard({
  session,
  name,
  hasAvatar,
  avatarVersion,
  className,
}: {
  session: Session;
  name: string;
  hasAvatar: boolean;
  avatarVersion: string | null;
  className: string | null;
}) {
  const [actionCenter, courses] = await Promise.all([
    getStudentActionCenter(session.user.id),
    listStudentCourses(session.user.id),
  ]);
  const dueByCourse = countBy(actionCenter.due, (item) => item.courseId);
  const returnedByCourse = countBy(
    actionCenter.returned,
    (item) => item.courseId
  );
  const scoreByCourse = countBy(
    actionCenter.recentScores,
    (item) => item.courseId
  );
  const focusItem = actionCenter.returned[0] ?? actionCenter.due[0];

  return (
    <>
      {/* Top summary band — greeting + what needs handling today. */}
      <section
        className="card-accent card-accent-blue relative overflow-hidden rounded-3xl p-6 sm:p-8"
        style={{ minHeight: 168 }}
      >
        <AmbientBackground tone="blue" intensity={0.55} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 90% 0%, rgba(255,255,255,0.22) 0%, transparent 55%), linear-gradient(180deg, rgba(10,132,255,0.0) 40%, rgba(10,132,255,0.35) 100%)",
          }}
        />
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
                นักเรียน
              </span>
              {className && (
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
                  {className}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <UserAvatar
                userId={session.user.id}
                hasImage={hasAvatar}
                version={avatarVersion}
                size={44}
                className="ring-2 ring-white/40"
              />
              <h1
                className="text-2xl font-semibold text-white sm:text-3xl"
                style={{ letterSpacing: "-0.03em" }}
              >
                สวัสดี, {name}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/join"
                className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 hover:no-underline"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                เข้าร่วมห้องเรียน
              </Link>
              <Link
                href="/student/terms"
                className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/20 hover:no-underline"
              >
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
                ผลการเรียน
              </Link>
              <Link
                href="/student/timetable"
                className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/20 hover:no-underline"
              >
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                ตารางเรียน
              </Link>
            </div>
          </div>
          <div className="relative hidden h-40 w-40 shrink-0 md:block">
            <Image
              src="/brand/student-mascot-transparent.webp"
              alt=""
              fill
              priority
              sizes="160px"
              className="object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
            />
          </div>
        </div>
      </section>

      <DashboardOperatingGrid
        role="student"
        showModeration={moderationCenterEnabled()}
        main={
          <div className="space-y-5">
            <section>
              <DashboardSectionHeading role="student" count={courses.length} />
              {courses.length === 0 ? (
                <CourseShowcaseEmpty
                  href="/join"
                  title="ยังไม่มีวิชาเรียน"
                  hint="เข้าร่วมด้วยรหัสห้องจากครู แล้ววิชาของคุณจะแสดงตรงนี้"
                  actionLabel="เข้าร่วมห้องเรียน"
                />
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {courses.map((e) => {
                    const courseId = e.course.id;
                    const dueCount = dueByCourse.get(courseId) ?? 0;
                    const returnedCount = returnedByCourse.get(courseId) ?? 0;
                    const needsAction = dueCount + returnedCount;
                    return (
                      <CourseShowcaseCard
                        key={e.id}
                        href={`/student/courses/${courseId}`}
                        title={e.course.name}
                        subtitle={e.course.class.name}
                        badge={yearLabelFromTerm(e.course.term.name)}
                        classId={e.course.class.id}
                        avatarUserId={e.course.teacher.userId}
                        hasAvatar={Boolean(
                          e.course.teacher.user.profileImageId
                        )}
                        avatarAlt={`ครู ${e.course.teacher.firstName} ${e.course.teacher.lastName}`}
                        notice={
                          needsAction > 0
                            ? `มีงานต้องจัดการ ${needsAction} ชิ้น`
                            : `ครู ${e.course.teacher.firstName} ${e.course.teacher.lastName}`
                        }
                        noticeTone={needsAction > 0 ? "attention" : "muted"}
                        stats={[
                          { value: dueCount, label: "งานต้องส่ง" },
                          {
                            value: scoreByCourse.get(courseId) ?? 0,
                            label: "คะแนน",
                          },
                          { value: "1", label: "ครู" },
                        ]}
                        actionLabel="เข้าวิชา"
                        menu={
                          <StudentCourseCardMenu
                            courseId={courseId}
                            courseName={e.course.name}
                          />
                        }
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <ReturnedWorkBlock items={actionCenter.returned} />
            <DueWorkBlock items={actionCenter.due} />
          </div>
        }
        aside={
          <>
            <DashboardFocusBrief
              role="student"
              title={focusItem?.title ?? "ไม่มีงานค้างในตอนนี้"}
              detail={
                focusItem
                  ? `${focusItem.courseName} · เปิดงานนี้แล้วทำต่อได้ทันที`
                  : "คุณจัดการงานครบแล้ว วิชาและคะแนนล่าสุดยังอยู่ด้านล่าง"
              }
              href={
                focusItem
                  ? `/student/courses/${focusItem.courseId}/assignments/${focusItem.assignmentId}`
                  : "/student/courses"
              }
            />
            <StudentTodayPanel studentUserId={session.user.id} />
            <RecentScoresBlock items={actionCenter.recentScores} />
          </>
        }
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Teacher
// ─────────────────────────────────────────────────────────────

async function TeacherDashboard({
  teacherUserId,
  name,
  hasAvatar,
  avatarVersion,
  homeroomName,
}: {
  teacherUserId: string;
  name: string;
  hasAvatar: boolean;
  avatarVersion: string | null;
  homeroomName: string | null;
}) {
  const [reviewQueue, classHealth, term] = await Promise.all([
    getTeacherReviewQueue(teacherUserId),
    getTeacherClassHealth(teacherUserId),
    currentTerm(),
  ]);

  return (
    <>
      {homeroomName && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="badge">ครูประจำชั้น {homeroomName}</span>
        </div>
      )}

      <TeacherHero
        teacherUserId={teacherUserId}
        name={name}
        hasAvatar={hasAvatar}
        avatarVersion={avatarVersion}
      />

      <DashboardOperatingGrid
        role="teacher"
        showModeration={moderationCenterEnabled()}
        main={
          <div className="space-y-5">
            <section>
              <DashboardSectionHeading
                role="teacher"
                count={classHealth.length}
                action={
                  <Link
                    href="/teacher/courses/new"
                    className="btn-primary btn-sm"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    สร้างวิชา
                  </Link>
                }
              />

              {classHealth.length === 0 ? (
                <CourseShowcaseEmpty
                  href="/teacher/courses/new"
                  title="ยังไม่มีวิชาที่สอน"
                  hint="สร้างวิชาแรก แล้วแชร์รหัสห้องให้นักเรียนเข้าร่วม"
                  actionLabel="สร้างวิชา"
                />
              ) : (
                <div className="grid gap-5 md:grid-cols-2">
                  {classHealth.map((c) => (
                    <CourseShowcaseCard
                      key={c.courseId}
                      href={`/teacher/courses/${c.courseId}`}
                      title={c.courseName}
                      subtitle={c.className}
                      badge={yearLabelFromTerm(
                        term?.academicYearName ?? term?.name
                      )}
                      classId={c.classId}
                      avatarUserId={teacherUserId}
                      hasAvatar={hasAvatar}
                      avatarAlt={`ครู ${name}`}
                      notice={
                        c.pendingReview > 0
                          ? `รอตรวจ ${c.pendingReview} ชิ้น`
                          : "พร้อมดูแลห้องเรียน"
                      }
                      noticeTone={c.pendingReview > 0 ? "attention" : "success"}
                      stats={[
                        { value: c.activeStudents, label: "นักเรียน" },
                        { value: c.pendingReview, label: "รอตรวจ" },
                        { value: c.draftScoreItems, label: "ร่างคะแนน" },
                      ]}
                      actionLabel="ดูข้อมูล"
                      menu={
                        <TeacherCourseCardMenu
                          courseId={c.courseId}
                          courseName={c.courseName}
                        />
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            <ReviewQueueBlock items={reviewQueue} />
          </div>
        }
        aside={
          <>
            <DashboardFocusBrief
              role="teacher"
              title={reviewQueue[0]?.title ?? "ตรวจครบทุกชิ้นแล้ว"}
              detail={
                reviewQueue[0]
                  ? `${reviewQueue[0].courseName} · ห้อง ${reviewQueue[0].className} · รอตรวจ ${reviewQueue[0].pendingCount} ชิ้น`
                  : "งานส่งใหม่ของนักเรียนจะปรากฏตรงนี้โดยอัตโนมัติ"
              }
              href={
                reviewQueue[0]
                  ? `/teacher/courses/${reviewQueue[0].courseId}/assignments/${reviewQueue[0].assignmentId}?filter=pending`
                  : "/teacher/courses"
              }
            />
            <ClassHealthBlock rows={classHealth} />
          </>
        }
      />
    </>
  );
}
