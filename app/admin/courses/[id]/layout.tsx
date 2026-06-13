import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Eye } from "lucide-react";
import { db } from "@/lib/db/client";
import { TabNav } from "@/components/course/tab-nav";
import { UserAvatar } from "@/components/profile/user-avatar";
import { adminCourseTabs } from "./_tabs";

export const dynamic = "force-dynamic";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function AdminCourseObserverLayout({
  children,
  params,
}: LayoutProps) {
  const { id } = await params;
  const course = await db.courseOffering.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      subjectCode: true,
      gradeLevel: true,
      creditHours: true,
      class: { select: { id: true, name: true } },
      term: { select: { name: true } },
      teacher: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          user: { select: { profileImageId: true } },
        },
      },
    },
  });

  if (!course) notFound();

  return (
    <div className="mx-auto max-w-6xl animate-fade-in space-y-6 px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/classes" className="btn-ghost btn-sm">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          กลับไปห้องเรียนทั้งหมด
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-500/10">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Admin Observer · อ่านอย่างเดียว
        </span>
      </div>

      <section className="card-hero">
        <div
          className="card-hero-banner overflow-hidden"
          style={{ height: 180 }}
          aria-hidden="true"
        >
          <Image
            src="/brand/classroom-teaching.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, 1152px"
            className="object-cover"
            style={{ objectPosition: "center 18%" }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-12"
            style={{
              background:
                "linear-gradient(to top, var(--color-surface) 0%, transparent 100%)",
            }}
          />
          <span className="glass-nav absolute left-6 top-4 z-10 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium text-black/70">
            รายวิชาจากครู
          </span>
        </div>

        <div className="card-hero-content relative -mt-10 pb-0">
          <div className="flex items-start gap-4">
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-card"
              aria-hidden="true"
            >
              <UserAvatar
                userId={course.teacher.userId}
                hasImage={course.teacher.user.profileImageId !== null}
                size={64}
                className="rounded-2xl ring-0"
              />
            </span>
            <div className="min-w-0 flex-1 pb-1 pt-4">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-ink md:text-3xl">
                {course.name}
              </h1>
              <p className="mt-1 truncate text-sm text-ink-mute">
                ห้อง {course.class.name} · {course.gradeLevel} ·{" "}
                {course.creditHours} หน่วยกิต
                {course.subjectCode ? ` · รหัส ${course.subjectCode}` : ""} ·
                สอนโดย {course.teacher.firstName} {course.teacher.lastName} ·{" "}
                {course.term.name}
              </p>
            </div>
          </div>

          <div className="-mx-6 mt-5 px-6 pb-0 pt-2">
            <TabNav tabs={adminCourseTabs(id)} />
          </div>
        </div>
      </section>

      {children}
    </div>
  );
}
