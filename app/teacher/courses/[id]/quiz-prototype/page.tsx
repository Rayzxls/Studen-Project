import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { TopNav } from "@/components/layout/top-nav";
import { QuizWorkspacePrototype } from "@/components/prototype/quiz-workspace-prototype";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; theme?: string }>;
};

export default async function QuizPrototypePage({
  params,
  searchParams,
}: PageProps) {
  if (process.env.NODE_ENV === "production") notFound();

  const { id } = await params;
  const query = await searchParams;

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={null} maxWidth="max-w-6xl" />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 md:px-6 md:py-8">
        <Link
          href={`/teacher/courses/${id}/lessons`}
          className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-blue-700"
        >
          <ChevronLeft className="h-4 w-4" /> กลับหน้าบทเรียน
        </Link>

        <header className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="badge">พื้นที่ทดลอง · ไม่บันทึกข้อมูล</span>
            <h1 className="mt-3 text-2xl font-semibold text-ink md:text-3xl">
              ต้นแบบแบบทดสอบ
            </h1>
            <p className="mt-1 text-sm text-ink-mute">
              ทดลองเส้นทางสร้าง ทำ และตรวจผล ก่อนเริ่มพัฒนาระบบจริง
            </p>
          </div>
          <span className="text-xs text-ink-mute">
            ENG · บท Grammar essentials
          </span>
        </header>

        <QuizWorkspacePrototype
          courseId={id}
          initialView={normalizeView(query.view)}
          initialTheme={normalizeTheme(query.theme)}
        />
      </main>
    </div>
  );
}

function normalizeView(
  value: string | undefined
): "builder" | "attempt" | "results" {
  return value === "attempt" || value === "results" ? value : "builder";
}

function normalizeTheme(value: string | undefined): "light" | "dark" | "cream" {
  return value === "dark" || value === "cream" ? value : "light";
}
