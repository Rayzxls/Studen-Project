import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/layout/top-nav";
import { LessonWorkspacePrototype } from "@/components/prototype/lesson-workspace-prototype";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string; theme?: string }>;
};

export default async function LessonsPrototypePage({
  params,
  searchParams,
}: PageProps) {
  if (process.env.NODE_ENV === "production") notFound();

  const { id } = await params;
  const query = await searchParams;

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={null} maxWidth="max-w-5xl" />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6 md:py-8">
        <Link
          href={`/teacher/courses/${id}/feed`}
          className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-blue-700"
        >
          <ChevronLeft className="h-4 w-4" /> กลับหน้าวิชา
        </Link>

        <header className="border-b border-hairline pb-5">
          <span className="badge">พื้นที่ทดลอง · ไม่บันทึกข้อมูล</span>
          <h1 className="mt-3 text-3xl font-semibold text-ink">ENG</h1>
          <p className="mt-1 text-sm text-ink-mute">
            ห้อง ม.4/1 · ต้นแบบโครงสร้างบทเรียน
          </p>
        </header>

        <LessonWorkspacePrototype
          courseId={id}
          courseName="ENG"
          initialRole={query.role === "student" ? "student" : "teacher"}
          initialTheme={normalizeTheme(query.theme)}
        />
      </main>
    </div>
  );
}

function normalizeTheme(value: string | undefined): "light" | "dark" | "cream" {
  return value === "dark" || value === "cream" ? value : "light";
}
