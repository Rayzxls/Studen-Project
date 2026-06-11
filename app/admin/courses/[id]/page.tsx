import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ClipboardList,
  Eye,
  GraduationCap,
  Users,
} from "lucide-react";
import { db } from "@/lib/db/client";
import { UserAvatar } from "@/components/profile/user-avatar";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCourseObserverPage({ params }: PageProps) {
  const { id } = await params;
  const course = await db.courseOffering.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      subjectCode: true,
      gradeLevel: true,
      creditHours: true,
      classCode: true,
      codeActive: true,
      createdAt: true,
      teacher: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
          user: { select: { profileImageId: true } },
        },
      },
      class: {
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          academicYear: { select: { name: true } },
        },
      },
      term: {
        select: {
          name: true,
          academicYear: { select: { name: true } },
        },
      },
      _count: {
        select: {
          enrollments: { where: { removedAt: null } },
          assignments: true,
          scoreItems: true,
          materials: true,
          announcements: true,
          timetableSlots: true,
        },
      },
    },
  });

  if (!course) notFound();

  return (
    <div className="mx-auto max-w-6xl animate-fade-in space-y-6 px-6 py-8 md:px-10">
      <Link
        href="/admin/classes"
        className="inline-flex items-center gap-1 text-xs font-medium text-black/50 transition hover:text-black hover:no-underline"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        กลับไปห้องเรียนทั้งหมด
      </Link>

      <header className="card overflow-hidden">
        <div className="border-b border-black/[0.06] bg-blue-50/70 px-6 py-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700 shadow-soft">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Admin Observer · อ่านอย่างเดียว
          </div>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_300px]">
          <div>
            <div className="badge mb-3">รายวิชาที่ครูสร้าง</div>
            <h1 className="text-3xl font-semibold tracking-tight text-black md:text-4xl">
              {course.name}
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              {course.subjectCode || "ไม่มีรหัสวิชา"} · {course.gradeLevel} ·{" "}
              {course.creditHours} หน่วยกิต · {course.term.academicYear.name} ·{" "}
              {course.term.name}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric
                icon={<Users className="h-4 w-4" />}
                label="นักเรียน"
                value={course._count.enrollments}
              />
              <Metric
                icon={<ClipboardList className="h-4 w-4" />}
                label="งาน"
                value={course._count.assignments}
              />
              <Metric
                icon={<GraduationCap className="h-4 w-4" />}
                label="รายการคะแนน"
                value={course._count.scoreItems}
              />
            </div>
          </div>

          <aside className="rounded-2xl bg-black/[0.03] p-4">
            <p className="text-xs font-medium text-ink-soft">ครูผู้สอน</p>
            <Link
              href={`/admin/users/${course.teacher.userId}`}
              className="mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft transition hover:shadow-card hover:no-underline"
            >
              <UserAvatar
                userId={course.teacher.userId}
                hasImage={Boolean(course.teacher.user.profileImageId)}
                size={44}
              />
              <span className="min-w-0">
                <span className="block font-medium text-black">
                  {course.teacher.firstName} {course.teacher.lastName}
                </span>
                <span className="block truncate text-xs text-ink-soft">
                  {course.teacher.email}
                </span>
              </span>
            </Link>
            <div className="mt-4 space-y-2 text-xs text-ink-soft">
              <p>
                ห้อง:{" "}
                <Link
                  href={`/admin/classes/${course.class.id}`}
                  className="font-medium text-black hover:underline"
                >
                  {course.class.name}
                </Link>
              </p>
              <p>
                รหัสเข้าห้อง:{" "}
                <span className="font-mono text-black">{course.classCode}</span>
              </p>
              <p>สถานะรับเข้า: {course.codeActive ? "เปิดรับ" : "ปิดรับ"}</p>
            </div>
          </aside>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <ReadOnlyTile
          icon={<BookOpen className="h-5 w-5" />}
          title="Feed / เอกสาร / ประกาศ"
          description="ชั้นถัดไปจะนำหน้า Feed ของครูมาแสดงแบบอ่านอย่างเดียว และซ่อนปุ่มสร้าง/แก้ไข/ลบทั้งหมด"
        />
        <ReadOnlyTile
          icon={<ClipboardList className="h-5 w-5" />}
          title="งาน / คะแนน / สมาชิก"
          description="ชั้นถัดไปจะเปิดดูข้อมูลเหมือนครู แต่ทุก action ที่แก้ข้อมูลจะถูกซ่อนจาก Admin Observer"
        />
        <ReadOnlyTile
          icon={<CalendarClock className="h-5 w-5" />}
          title="เช็คชื่อ"
          description={`มีตารางสอน ${course._count.timetableSlots.toLocaleString("th-TH")} รายการในวิชานี้`}
        />
        <ReadOnlyTile
          icon={<GraduationCap className="h-5 w-5" />}
          title="ภาพรวม"
          description={`มีเอกสาร ${course._count.materials.toLocaleString("th-TH")} และประกาศ ${course._count.announcements.toLocaleString("th-TH")} รายการ`}
        />
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-black/[0.035] p-4">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-blue-600 shadow-soft">
        {icon}
      </div>
      <p className="text-2xl font-semibold text-black">
        {value.toLocaleString("th-TH")}
      </p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  );
}

function ReadOnlyTile({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        {icon}
      </div>
      <h2 className="font-semibold text-black">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-ink-soft">{description}</p>
    </div>
  );
}
