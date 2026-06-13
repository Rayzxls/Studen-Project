import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award,
  CalendarCheck,
  ClipboardCheck,
  ListChecks,
  Users,
} from "lucide-react";
import { AttendanceStatus, SubmissionStatus } from "@prisma/client";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCourseOverviewPage({ params }: PageProps) {
  const { id } = await params;

  const courseExists = await db.courseOffering.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!courseExists) notFound();

  const [scoreItems, enrollments, pendingByEnrollment, attendanceByEnrollment] =
    await Promise.all([
      db.scoreItem.findMany({
        where: { courseOfferingId: id },
        select: {
          id: true,
          name: true,
          fullScore: true,
          position: true,
          publishedAt: true,
        },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      }),
      db.enrollment.findMany({
        where: {
          courseOfferingId: id,
          removedAt: null,
        },
        select: {
          id: true,
        },
      }),
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

  const attendanceMap = new Map<string, { marked: number; attended: number }>();
  for (const g of attendanceByEnrollment) {
    const row = attendanceMap.get(g.enrollmentId) ?? { marked: 0, attended: 0 };
    row.marked += g._count._all;
    if (
      g.status === AttendanceStatus.PRESENT ||
      g.status === AttendanceStatus.LATE
    ) {
      row.attended += g._count._all;
    }
    attendanceMap.set(g.enrollmentId, row);
  }

  const publishedItems = scoreItems.filter((it) => it.publishedAt !== null);
  const publishedFullScore = publishedItems.reduce(
    (sum, it) => sum + Math.max(0, it.fullScore),
    0
  );
  const pendingTotal = pendingByEnrollment.reduce(
    (sum, g) => sum + g._count._all,
    0
  );

  let markedAll = 0;
  let attendedAll = 0;
  for (const row of attendanceMap.values()) {
    markedAll += row.marked;
    attendedAll += row.attended;
  }
  const avgAttendance =
    markedAll > 0 ? Math.round((attendedAll / markedAll) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          href={`/admin/courses/${id}/members`}
          icon={<Users className="h-4 w-4" />}
          label="นักเรียนทั้งหมด"
          value={enrollments.length}
          suffix="คน"
          tone="blue"
        />
        <MetricCard
          href={`/admin/courses/${id}/assignments`}
          icon={<ClipboardCheck className="h-4 w-4" />}
          label="งานรอตรวจ"
          value={pendingTotal}
          suffix="ชิ้น"
          tone={pendingTotal > 0 ? "orange" : "plain"}
        />
        <MetricCard
          href={`/admin/courses/${id}/scores`}
          icon={<Award className="h-4 w-4" />}
          label="คะแนนที่ประกาศแล้ว"
          value={publishedItems.length}
          suffix="รายการ"
          tone="blue"
        />
        <MetricCard
          href={`/admin/courses/${id}/attendance`}
          icon={<CalendarCheck className="h-4 w-4" />}
          label="เข้าเรียนเฉลี่ย"
          value={avgAttendance ?? "—"}
          suffix={avgAttendance === null ? "" : "%"}
          tone="plain"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard
          href={`/admin/courses/${id}/scores`}
          icon={<Award className="h-5 w-5" />}
          title="คะแนนและเกรด"
          description="ดูแยกรายการคะแนนว่าแต่ละคนได้คะแนนจากส่วนไหนบ้าง พร้อมคะแนนรวม เปอร์เซ็นต์ และเกรดของรายวิชา"
          meta={`ประกาศแล้ว ${publishedItems.length}/${scoreItems.length} รายการ · คะแนนเต็มที่ประกาศ ${publishedFullScore}`}
        />
        <DetailCard
          href={`/admin/courses/${id}/attendance`}
          icon={<ListChecks className="h-5 w-5" />}
          title="การเข้าเรียน"
          description="ดูจำนวนมาเรียน สาย ลา ขาด และค่อยสรุปเป็นเปอร์เซ็นต์การเข้าเรียนของแต่ละคน"
          meta={`เช็คแล้ว ${markedAll.toLocaleString("th-TH")} รายการ · เฉลี่ย ${avgAttendance === null ? "—" : `${avgAttendance}%`}`}
        />
      </div>
    </div>
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
    <Link href={href} className={`${className} block p-5 hover:no-underline`}>
      <p className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">
        {typeof value === "number" ? value.toLocaleString("th-TH") : value}
        {suffix && <span className="ml-1 text-base font-medium">{suffix}</span>}
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
