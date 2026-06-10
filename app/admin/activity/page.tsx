import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ClipboardList,
  FileText,
  Megaphone,
  BookOpen,
  ScrollText,
} from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { currentTerm } from "@/lib/dashboard/queries";

/**
 * Admin Activity Review — `/admin/activity`.
 *
 * General teaching activity across the school (assignments / materials /
 * announcements / new CourseOfferings), read-only, for the academic-affairs
 * lens. Deliberately separate from `/admin/audit`:
 *
 *   Audit Log        — security + data-integrity trail (who changed what,
 *                      with reason). Tiered Critical/Important.
 *   Activity Review  — what teaching is happening (posts, new courses).
 *                      No tiers, no reasons, never a substitute for audit.
 *
 * Filters are URL-driven (GET form, no client JS): type, course, time range.
 * TODO(activity-review): actor filter + pagination land with the dedicated
 * activity query module; current version reads the four source tables
 * directly with take-caps and merges in memory.
 */

export const dynamic = "force-dynamic";

type ActivityType = "assignment" | "material" | "announcement" | "course";
type RangeKey = "7d" | "30d" | "term" | "all";

const TYPE_META: Record<
  ActivityType,
  { label: string; chip: string; icon: typeof FileText }
> = {
  assignment: {
    label: "การบ้าน",
    chip: "bg-blue-50 text-blue-700",
    icon: ClipboardList,
  },
  material: {
    label: "เอกสาร",
    chip: "bg-green-50 text-green-700",
    icon: FileText,
  },
  announcement: {
    label: "ประกาศ",
    chip: "bg-orange-50 text-orange-700",
    icon: Megaphone,
  },
  course: {
    label: "เปิดวิชา",
    chip: "bg-black/[0.05] text-black/60",
    icon: BookOpen,
  },
};

const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "7 วันล่าสุด",
  "30d": "30 วันล่าสุด",
  term: "เทอมนี้",
  all: "ทั้งหมด",
};

interface ActivityRow {
  key: string;
  type: ActivityType;
  title: string;
  courseName: string | null;
  className: string | null;
  actorName: string;
  at: Date;
  href: string | null;
}

interface PageProps {
  searchParams: Promise<{ type?: string; courseId?: string; range?: string }>;
}

/** Time floor for the fixed ranges — request-time read, outside render scope. */
function rangeFloor(range: RangeKey): Date | null {
  const DAY = 24 * 3600 * 1000;
  if (range === "7d") return new Date(Date.now() - 7 * DAY);
  if (range === "30d") return new Date(Date.now() - 30 * DAY);
  return null;
}

export default async function AdminActivityPage({ searchParams }: PageProps) {
  try {
    await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const type: ActivityType | "all" = (
    ["assignment", "material", "announcement", "course"] as const
  ).includes(sp.type as ActivityType)
    ? (sp.type as ActivityType)
    : "all";
  const range: RangeKey = (["7d", "30d", "term", "all"] as const).includes(
    sp.range as RangeKey
  )
    ? (sp.range as RangeKey)
    : "30d";
  const courseId = sp.courseId?.trim() || null;

  const term = await currentTerm();

  // Resolve the time floor for the selected range.
  let since: Date | null = rangeFloor(range);
  if (range === "term" && term) {
    const t = await db.term.findUnique({
      where: { id: term.id },
      select: { startDate: true },
    });
    since = t?.startDate ?? null;
  }

  const PER_TYPE_CAP = 40;
  const courseWhere = courseId ? { courseOfferingId: courseId } : {};

  const wants = (t: ActivityType) => type === "all" || type === t;

  const [assignments, materials, announcements, courses, courseOptions] =
    await Promise.all([
      wants("assignment")
        ? db.assignment.findMany({
            where: {
              ...courseWhere,
              ...(since ? { createdAt: { gte: since } } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: PER_TYPE_CAP,
            select: {
              id: true,
              title: true,
              createdAt: true,
              course: {
                select: {
                  id: true,
                  name: true,
                  class: { select: { name: true } },
                  teacher: { select: { firstName: true, lastName: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      wants("material")
        ? db.material.findMany({
            where: {
              ...courseWhere,
              deletedAt: null,
              ...(since ? { postedAt: { gte: since } } : {}),
            },
            orderBy: { postedAt: "desc" },
            take: PER_TYPE_CAP,
            select: {
              id: true,
              title: true,
              postedAt: true,
              course: {
                select: {
                  id: true,
                  name: true,
                  class: { select: { name: true } },
                  teacher: { select: { firstName: true, lastName: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      wants("announcement")
        ? db.announcement.findMany({
            where: {
              ...courseWhere,
              deletedAt: null,
              ...(since ? { postedAt: { gte: since } } : {}),
            },
            orderBy: { postedAt: "desc" },
            take: PER_TYPE_CAP,
            select: {
              id: true,
              title: true,
              body: true,
              postedAt: true,
              course: {
                select: {
                  id: true,
                  name: true,
                  class: { select: { name: true } },
                  teacher: { select: { firstName: true, lastName: true } },
                },
              },
            },
          })
        : Promise.resolve([]),
      wants("course")
        ? db.courseOffering.findMany({
            where: {
              ...(courseId ? { id: courseId } : {}),
              ...(since ? { createdAt: { gte: since } } : {}),
            },
            orderBy: { createdAt: "desc" },
            take: PER_TYPE_CAP,
            select: {
              id: true,
              name: true,
              createdAt: true,
              class: { select: { name: true } },
              teacher: { select: { firstName: true, lastName: true } },
            },
          })
        : Promise.resolve([]),
      // Course filter options — active term first, then everything else.
      db.courseOffering.findMany({
        orderBy: [{ createdAt: "desc" }],
        take: 200,
        select: {
          id: true,
          name: true,
          class: { select: { name: true } },
        },
      }),
    ]);

  const rows: ActivityRow[] = [
    ...assignments.map((a) => ({
      key: `a-${a.id}`,
      type: "assignment" as const,
      title: a.title,
      courseName: a.course.name,
      className: a.course.class.name,
      actorName: `${a.course.teacher.firstName} ${a.course.teacher.lastName}`,
      at: a.createdAt,
      href: null,
    })),
    ...materials.map((m) => ({
      key: `m-${m.id}`,
      type: "material" as const,
      title: m.title,
      courseName: m.course.name,
      className: m.course.class.name,
      actorName: `${m.course.teacher.firstName} ${m.course.teacher.lastName}`,
      at: m.postedAt,
      href: null,
    })),
    ...announcements.map((an) => ({
      key: `an-${an.id}`,
      type: "announcement" as const,
      title: an.title?.trim() || an.body.slice(0, 80),
      courseName: an.course.name,
      className: an.course.class.name,
      actorName: `${an.course.teacher.firstName} ${an.course.teacher.lastName}`,
      at: an.postedAt,
      href: null,
    })),
    ...courses.map((c) => ({
      key: `c-${c.id}`,
      type: "course" as const,
      title: c.name,
      courseName: null,
      className: c.class.name,
      actorName: `${c.teacher.firstName} ${c.teacher.lastName}`,
      at: c.createdAt,
      href: null,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 60);

  const dateFmt = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="animate-fade-in space-y-6 p-6 md:p-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-3xl font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            กิจกรรมในระบบ
          </h1>
          <p className="mt-1 text-sm text-black/55">
            ความเคลื่อนไหวการสอนทั่วไป (การบ้าน · เอกสาร · ประกาศ · เปิดวิชา) —
            แยกจาก{" "}
            <Link
              href="/admin/audit"
              className="text-blue-700 underline underline-offset-2"
            >
              Audit Log
            </Link>{" "}
            ซึ่งเป็นบันทึกความปลอดภัยและการแก้ไขข้อมูลสำคัญ
          </p>
        </div>
      </div>

      {/* Filters — URL-driven GET form. */}
      <form
        method="GET"
        className="card flex flex-wrap items-end gap-3 p-4"
        aria-label="ตัวกรองกิจกรรม"
      >
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          ประเภท
          <select name="type" defaultValue={type} className="input min-w-36">
            <option value="all">ทุกประเภท</option>
            <option value="assignment">การบ้าน</option>
            <option value="material">เอกสาร</option>
            <option value="announcement">ประกาศ</option>
            <option value="course">เปิดวิชา</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          วิชา
          <select
            name="courseId"
            defaultValue={courseId ?? ""}
            className="input min-w-48 max-w-64"
          >
            <option value="">ทุกวิชา</option>
            {courseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.class.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          ช่วงเวลา
          <select name="range" defaultValue={range} className="input min-w-32">
            {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
              <option key={k} value={k}>
                {RANGE_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        {/* TODO(activity-review): actor filter — needs a teacher picker +
            postedBy-aware query; lands with the activity query module. */}
        <button type="submit" className="btn-secondary btn-sm">
          กรอง
        </button>
        {(type !== "all" || courseId || range !== "30d") && (
          <Link
            href="/admin/activity"
            className="text-xs text-black/50 hover:text-black hover:underline"
          >
            ล้างตัวกรอง
          </Link>
        )}
      </form>

      {/* Result list */}
      <section className="card overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Activity
              className="mx-auto h-8 w-8 text-black/20"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-black/70">
              ไม่มีกิจกรรมในช่วงที่เลือก
            </p>
            <p className="mt-1 text-xs text-black/45">
              ลองขยายช่วงเวลา หรือล้างตัวกรองประเภท/วิชา
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] bg-black/[0.02] text-left text-xs text-black/50">
                  <th className="px-4 py-2.5 font-medium">เวลา</th>
                  <th className="px-4 py-2.5 font-medium">ประเภท</th>
                  <th className="px-4 py-2.5 font-medium">รายการ</th>
                  <th className="px-4 py-2.5 font-medium">โดย</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05]">
                {rows.map((r) => {
                  const meta = TYPE_META[r.type];
                  const Icon = meta.icon;
                  return (
                    <tr key={r.key} className="hover:bg-black/[0.015]">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-black/55">
                        {dateFmt.format(r.at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}
                        >
                          <Icon className="h-3 w-3" aria-hidden="true" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="max-w-[28rem] px-4 py-3">
                        <p className="truncate font-medium text-black">
                          {r.title}
                        </p>
                        <p className="truncate text-xs text-black/50">
                          {r.courseName
                            ? `${r.courseName} · ห้อง ${r.className}`
                            : `ห้อง ${r.className}`}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-black/70">
                        {r.actorName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="flex items-center gap-1.5 text-[11px] text-black/40">
        <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
        ต้องการดูการแก้คะแนน / ลบข้อมูล / ความปลอดภัย? ไปที่{" "}
        <Link href="/admin/audit" className="text-blue-700 hover:underline">
          Audit Log
        </Link>
      </p>
    </div>
  );
}
