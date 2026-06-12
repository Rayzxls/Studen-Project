import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Award,
  CalendarCheck,
  ClipboardCheck,
  ListChecks,
  Users,
} from "lucide-react";
import { AttendanceStatus, SubmissionStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { getCourseOfferingForTeacher } from "@/lib/course/queries";
import { getScoreboardForTeacher } from "@/lib/scoring/queries";
import { db } from "@/lib/db/client";
import { CourseShell } from "@/components/course/course-shell";
import { AnimatedStat } from "@/components/dashboard/animated-stat";
import { teacherCourseTabs } from "../_tabs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseOverviewPage({ params }: PageProps) {
  let session;
  try {
    session = await requireRole(["TEACHER"]);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;
  const course = await getCourseOfferingForTeacher(id, session.user.id);
  if (!course) notFound();

  const [scoreboard, pendingByEnrollment, attendanceByEnrollment] =
    await Promise.all([
      getScoreboardForTeacher(id, session.user.id),
      db.submission.groupBy({
        by: ["enrollmentId"],
        where: {
          assignment: { courseOfferingId: id },
          status: {
            in: [SubmissionStatus.SUBMITTED, SubmissionStatus.LATE_SUBMITTED],
          },
        },
        _count: { _all: true },
      }),
      db.attendanceRecord.groupBy({
        by: ["enrollmentId", "status"],
        where: { session: { courseOfferingId: id, cancelledAt: null } },
        _count: { _all: true },
      }),
    ]);

  const activeRows = scoreboard.rows.filter((row) => row.removedAt === null);
  const publishedItems = scoreboard.items.filter(
    (item) => item.publishedAt !== null
  );
  const publishedFullScore = publishedItems.reduce(
    (sum, item) => sum + Math.max(0, item.fullScore),
    0
  );
  const pendingTotal = pendingByEnrollment.reduce(
    (sum, group) => sum + group._count._all,
    0
  );

  let markedAll = 0;
  let attendedAll = 0;
  for (const group of attendanceByEnrollment) {
    markedAll += group._count._all;
    if (
      group.status === AttendanceStatus.PRESENT ||
      group.status === AttendanceStatus.LATE
    ) {
      attendedAll += group._count._all;
    }
  }
  const avgAttendance =
    markedAll > 0 ? Math.round((attendedAll / markedAll) * 100) : null;

  return (
    <CourseShell
      session={session}
      course={course}
      eyebrow="รายวิชาที่สอน"
      backHref="/teacher/courses"
      tabs={teacherCourseTabs(id)}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            href={`/teacher/courses/${id}/members`}
            icon={<Users className="h-3.5 w-3.5" />}
            label="นักเรียนทั้งหมด"
            value={activeRows.length}
            suffix="คน"
            tone="blue"
          />
          <MetricCard
            href={`/teacher/courses/${id}/assignments`}
            icon={<ClipboardCheck className="h-3.5 w-3.5" />}
            label="งานรอตรวจ"
            value={pendingTotal}
            suffix="ชิ้น"
            tone={pendingTotal > 0 ? "orange" : "plain"}
          />
          <MetricCard
            href={`/teacher/courses/${id}/scores`}
            icon={<Award className="h-3.5 w-3.5" />}
            label="คะแนนที่ประกาศแล้ว"
            value={publishedItems.length}
            suffix={`/${scoreboard.items.length} รายการ`}
            tone="blue"
          />
          <MetricCard
            href={`/teacher/courses/${id}/attendance`}
            icon={<CalendarCheck className="h-3.5 w-3.5" />}
            label="เข้าเรียนเฉลี่ย"
            value={avgAttendance ?? "—"}
            suffix={avgAttendance === null ? "" : "%"}
            tone="blue"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <DetailCard
            href={`/teacher/courses/${id}/scores`}
            icon={<Award className="h-5 w-5" />}
            title="คะแนนและเกรด"
            description="ดูแยกรายการคะแนนว่าแต่ละคนได้คะแนนจากส่วนไหนบ้าง พร้อมคะแนนรวม เปอร์เซ็นต์ และเกรดของรายวิชา"
            meta={`ประกาศแล้ว ${publishedItems.length}/${scoreboard.items.length} รายการ · คะแนนเต็มที่ประกาศ ${publishedFullScore}`}
          />
          <DetailCard
            href={`/teacher/courses/${id}/attendance`}
            icon={<ListChecks className="h-5 w-5" />}
            title="การเข้าเรียน"
            description="ดูจำนวนมาเรียน สาย ลา ขาด และค่อยสรุปเป็นเปอร์เซ็นต์การเข้าเรียนของแต่ละคน"
            meta={`เช็คแล้ว ${markedAll.toLocaleString("th-TH")} รายการ · เฉลี่ย ${avgAttendance === null ? "—" : `${avgAttendance}%`}`}
          />
        </div>
      </div>
    </CourseShell>
  );
}

function MetricCard({
  href,
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number | string;
  suffix: string;
  tone: "blue" | "orange" | "plain";
}) {
  const className =
    tone === "blue"
      ? "card-tinted card-tinted-blue"
      : tone === "orange"
        ? "card-tinted card-tinted-orange"
        : "card";

  return (
    <Link
      href={href}
      className={`${className} group block p-5 hover:no-underline`}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">
        {typeof value === "number" ? <AnimatedStat value={value} /> : value}
        {suffix && (
          <span className="ml-1 text-base font-medium opacity-60">
            {suffix}
          </span>
        )}
      </p>
    </Link>
  );
}

function DetailCard({
  href,
  icon,
  title,
  description,
  meta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link href={href} className="card block p-5 hover:no-underline">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        {icon}
      </div>
      <h2 className="text-base font-semibold text-black">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-ink-soft">{description}</p>
      <p className="mt-4 rounded-full bg-black/[0.04] px-3 py-1 text-xs text-ink-soft">
        {meta}
      </p>
    </Link>
  );
}
