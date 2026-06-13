import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BookOpen, Eye, Search } from "lucide-react";
import { db } from "@/lib/db/client";
import { currentTerm } from "@/lib/dashboard/queries";
import { PaginationLinks } from "@/components/pagination";
import { UserAvatar } from "@/components/profile/user-avatar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface PageProps {
  searchParams: Promise<{
    search?: string;
    teacherId?: string;
    classId?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminClassesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const search = (sp.search ?? "").trim();
  const teacherId = sp.teacherId ?? "";
  const classId = sp.classId ?? "";
  const status = sp.status ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const term = await currentTerm();
  const baseWhere: Prisma.CourseOfferingWhereInput = term
    ? { termId: term.id }
    : {};

  const where: Prisma.CourseOfferingWhereInput = {
    ...baseWhere,
    ...(teacherId ? { teacherId } : {}),
    ...(classId ? { classId } : {}),
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
            { gradeLevel: { contains: search, mode: "insensitive" } },
            {
              teacher: { firstName: { contains: search, mode: "insensitive" } },
            },
            {
              teacher: { lastName: { contains: search, mode: "insensitive" } },
            },
            { teacher: { email: { contains: search, mode: "insensitive" } } },
            { class: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [courses, total, teachers, classes] = await Promise.all([
    db.courseOffering.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      skip,
      take: PAGE_SIZE,
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
    db.class.findMany({
      where: { courses: { some: baseWhere } },
      orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        gradeLevel: true,
      },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = [search, teacherId, classId, status].filter(
    Boolean
  ).length;

  return (
    <div className="animate-fade-in space-y-5 p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="badge mb-2">Admin Observer</div>
          <h1 className="text-3xl font-medium tracking-tight">
            ห้องเรียนทั้งหมด
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {term
              ? `${term.academicYearName} · ${term.name}`
              : "ยังไม่ได้ตั้งค่าภาคเรียนปัจจุบัน"}{" "}
            · พบ {total.toLocaleString("th-TH")} วิชา
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
                placeholder="ชื่อวิชา รหัสวิชา รหัสเข้าห้อง ครู หรือห้อง..."
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
              ห้อง
            </label>
            <select name="classId" defaultValue={classId} className="input">
              <option value="">ทุกห้อง</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
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
            <Link href="/admin/classes" className="btn-ghost btn-sm">
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
              : "ยังไม่มีวิชาที่ครูสร้างในภาคเรียนนี้"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>วิชา</th>
                <th>ครูผู้สอน</th>
                <th>ห้องเรียน</th>
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
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {course.subjectCode || "ไม่มีรหัสวิชา"} ·{" "}
                        {course.creditHours} หน่วยกิต · {course.term.name}
                      </p>
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
                    <Link
                      href={`/admin/classes/${course.class.id}`}
                      className="font-medium text-black hover:underline"
                    >
                      {course.class.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {course.class.gradeLevel} · ปี{" "}
                      {course.class.academicYear.name}
                    </p>
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
        basePath="/admin/classes"
        page={Math.min(page, pageCount)}
        pageCount={pageCount}
        searchParams={{ search, teacherId, classId, status }}
      />
    </div>
  );
}
