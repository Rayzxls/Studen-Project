import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { SetupTabs, type SetupData } from "@/components/admin/setup-tabs";

// Auth-gated DB-fetching page — skip static prerender.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminSetupPage({ searchParams }: PageProps) {
  let session;
  try {
    session = await requireRole(["ADMIN"]);
  } catch {
    redirect("/dashboard");
  }

  const { tab } = await searchParams;
  const activeTab =
    tab === "terms" || tab === "classes" || tab === "teachers" ? tab : "years";

  const [years, terms, classes, teachers] = await Promise.all([
    db.academicYear.findMany({
      orderBy: { name: "desc" },
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: { select: { terms: true, classes: true } },
      },
    }),
    db.term.findMany({
      orderBy: [{ academicYear: { name: "desc" } }, { number: "desc" }],
      select: {
        id: true,
        name: true,
        number: true,
        isActive: true,
        startDate: true,
        endDate: true,
        academicYear: { select: { id: true, name: true } },
        _count: { select: { courses: true } },
      },
    }),
    db.class.findMany({
      orderBy: [{ academicYear: { name: "desc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        academicYear: { select: { id: true, name: true } },
        homeroomTeacher: {
          select: { userId: true, firstName: true, lastName: true },
        },
        _count: { select: { students: true, courses: true } },
      },
    }),
    db.teacher.findMany({
      orderBy: [{ firstName: "asc" }],
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        email: true,
        homeroomOf: { select: { id: true, name: true } },
      },
    }),
  ]);

  const data: SetupData = {
    years,
    terms,
    classes,
    teachers,
  };

  // Suppress unused-session lint — `session` is needed for the requireRole
  // type narrowing above even though it isn't rendered here.
  void session;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1
          className="text-2xl font-medium text-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          ตั้งค่าโครงสร้างโรงเรียน
        </h1>
        <p className="mt-1 text-sm text-black/60">
          จัดการปีการศึกษา · ภาคเรียน · ห้องเรียน · ครู (เพิ่มรายคน)
        </p>
      </header>
      <SetupTabs activeTab={activeTab} data={data} />
    </div>
  );
}
