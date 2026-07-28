import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BookOpen, Eye, Search } from "lucide-react";
import { db } from "@/lib/db/client";
import { PaginationLinks } from "@/components/pagination";
import { UserAvatar } from "@/components/profile/user-avatar";
import {
  courseAcademicPeriod,
  courseLearnerGroup,
  courseMetadataParts,
} from "@/lib/course/display";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{
    search?: string;
    teacherId?: string;
    learnerGroup?: string;
    lifecycle?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminClassesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = (sp.search ?? "").trim();
  const teacherId = sp.teacherId ?? "";
  const learnerGroup = (sp.learnerGroup ?? "").trim();
  const lifecycle =
    sp.lifecycle === "archive" || sp.lifecycle === "all"
      ? sp.lifecycle
      : "active";
  const status = sp.status ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const baseWhere: Prisma.CourseOfferingWhereInput =
    lifecycle === "active"
      ? { archivedAt: null }
      : lifecycle === "archive"
        ? { archivedAt: { not: null } }
        : {};

  const where: Prisma.CourseOfferingWhereInput = {
    ...baseWhere,
    ...(teacherId ? { teacherId } : {}),
    ...(learnerGroup ? { learnerGroupLabel: { equals: learnerGroup } } : {}),
    ...(status === "open"
      ? { codeActive: true }
      : status === "closed"
        ? { codeActive: false }
        : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { subjectCode: { contains: search, mode: "insensitive" } },
            { classCode: { contains: search, mode: "insensitive" } },
            {
              learnerGroupLabel: { contains: search, mode: "insensitive" },
            },
            {
              academicPeriodLabel: { contains: search, mode: "insensitive" },
            },
            {
              teacher: { firstName: { contains: search, mode: "insensitive" } },
            },
            {
              teacher: { lastName: { contains: search, mode: "insensitive" } },
            },
            { teacher: { email: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [courses, total, teachers, learnerGroups] = await Promise.all([
    db.courseOffering.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        subjectCode: true,
        learnerGroupLabel: true,
        academicPeriodLabel: true,
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
        _count: {
          select: {
            enrollments: { where: { removedAt: null } },
            assignments: true,
            scoreItems: true,
          },
        },
      },
    }),
    db.courseOffering.count({ where }),
    db.teacher.findMany({
      where: {
        courses: { some: baseWhere },
        user: { deletedAt: null },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        userId: true,
        firstName: true,
        lastName: true,
      },
    }),
    db.courseOffering.findMany({
      where: {
        ...baseWhere,
        learnerGroupLabel: { not: null },
      },
      distinct: ["learnerGroupLabel"],
      orderBy: { learnerGroupLabel: "asc" },
      select: { learnerGroupLabel: true },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = [
    search,
    teacherId,
    learnerGroup,
    lifecycle === "active" ? "" : lifecycle,
    status,
  ].filter(Boolean).length;

  return (
    <div className="animate-fade-in space-y-5 p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="badge mb-2">Admin Observer</div>
          <h1 className="text-3xl font-medium tracking-tight">
            รายวิชาทั้งหมด
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            มุมมองแบบอ่านอย่างเดียว · พบ {total.toLocaleString("th-TH")} วิชา
          </p>
        </div>
        <Link href="/admin/dashboard" className="btn-ghost btn-sm">
          กลับภาพรวม
        </Link>
      </div>

      <form method="get" className="card p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              ค้นหา
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                name="search"
                defaultValue={search}
                className="input pl-9"
                placeholder="ชื่อวิชา รหัสวิชา กลุ่มผู้เรียน ช่วงการศึกษา หรือครู..."
              />
            </div>
          </div>

          <div className="min-w-[170px]">
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              ครู
            </label>
            <select name="teacherId" defaultValue={teacherId} className="input">
              <option value="">ครูทุกคน</option>
              {teachers.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.firstName} {t.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              กลุ่มผู้เรียน
            </label>
            <select
              name="learnerGroup"
              defaultValue={learnerGroup}
              className="input"
            >
              <option value="">ทุกกลุ่ม</option>
              {learnerGroups.map((course) => (
                <option
                  key={course.learnerGroupLabel}
                  value={course.learnerGroupLabel ?? ""}
                >
                  {course.learnerGroupLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              วงจรชีวิต
            </label>
            <select name="lifecycle" defaultValue={lifecycle} className="input">
              <option value="active">กำลังใช้งาน</option>
              <option value="archive">เก็บถาวร</option>
              <option value="all">ทั้งหมด</option>
            </select>
          </div>

          <div className="min-w-[145px]">
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              รับนักเรียน
            </label>
            <select name="status" defaultValue={status} className="input">
              <option value="">ทุกสถานะ</option>
              <option value="open">เปิดรับ</option>
              <option value="closed">ปิดรับ</option>
            </select>
          </div>

          <button type="submit" className="btn-secondary">
            กรอง
          </button>
          {activeFilterCount > 0 && (
            <Link href="/admin/courses" className="btn-ghost btn-sm">
              ล้าง
            </Link>
          )}
        </div>
      </form>

      {courses.length === 0 ? (
        <div className="card-flat p-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-ink-soft" />
          <p className="mt-3 text-sm text-ink-soft">
            {activeFilterCount > 0
              ? "ไม่พบวิชาที่ตรงกับตัวกรอง"
              : "ยังไม่มีรายวิชาที่ตรงกับมุมมองนี้"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>วิชา</th>
                <th>ครูผู้สอน</th>
                <th>กลุ่ม / ช่วงการศึกษา</th>
                <th>นักเรียน</th>
                <th>งาน</th>
                <th>คะแนน</th>
                <th>รับเข้า</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td>
                    <div className="min-w-[210px]">
                      <p className="font-medium text-black">{course.name}</p>
                      {[
                        course.subjectCode || null,
                        ...courseMetadataParts(course),
                      ]
                        .filter(Boolean)
                        .join(" · ") && (
                        <p className="mt-0.5 text-xs text-ink-soft">
                          {[
                            course.subjectCode || null,
                            ...courseMetadataParts(course),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </td>
                  <td>
                    <Link
                      href={`/admin/users/${course.teacher.userId}`}
                      className="inline-flex items-center gap-2 font-medium text-black hover:underline"
                    >
                      <UserAvatar
                        userId={course.teacher.userId}
                        hasImage={Boolean(course.teacher.user.profileImageId)}
                        size={28}
                      />
                      <span>
                        {course.teacher.firstName} {course.teacher.lastName}
                      </span>
                    </Link>
                  </td>
                  <td className="text-sm">
                    {courseLearnerGroup(course) ? (
                      <span className="font-medium text-black">
                        {courseLearnerGroup(course)}
                      </span>
                    ) : (
                      <span className="text-ink-faint">ไม่ได้ระบุ</span>
                    )}
                    {courseAcademicPeriod(course) && (
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {courseAcademicPeriod(course)}
                      </p>
                    )}
                  </td>
                  <td className="text-sm">
                    {course._count.enrollments.toLocaleString("th-TH")}
                  </td>
                  <td className="text-sm">
                    {course._count.assignments.toLocaleString("th-TH")}
                  </td>
                  <td className="text-sm">
                    {course._count.scoreItems.toLocaleString("th-TH")}
                  </td>
                  <td>
                    {course.codeActive ? (
                      <span className="badge">เปิดรับ</span>
                    ) : (
                      <span className="badge">ปิดรับ</span>
                    )}
                    <p className="mt-1 font-mono text-[10px] text-ink-soft">
                      {course.classCode}
                    </p>
                  </td>
                  <td>
                    <Link
                      href={`/admin/courses/${course.id}`}
                      className="btn-secondary btn-sm"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      ดูข้อมูล
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaginationLinks
        basePath="/admin/courses"
        page={Math.min(page, pageCount)}
        pageCount={pageCount}
        searchParams={{
          search,
          teacherId,
          learnerGroup,
          lifecycle,
          status,
        }}
      />
    </div>
  );
}
