import { notFound } from "next/navigation";
import { TopNav } from "@/components/layout/top-nav";
import { LessonDetailPrototype } from "@/components/prototype/lesson-detail-prototype";

type PageProps = {
  params: Promise<{ id: string; lessonId: string }>;
  searchParams: Promise<{ theme?: string }>;
};

export default async function LessonDetailPrototypePage({
  params,
  searchParams,
}: PageProps) {
  if (process.env.NODE_ENV === "production") notFound();

  const { id, lessonId } = await params;
  const query = await searchParams;

  return (
    <div className="min-h-screen bg-bg">
      <TopNav session={null} maxWidth="max-w-5xl" />
      <LessonDetailPrototype
        courseId={id}
        lessonId={lessonId}
        theme={normalizeTheme(query.theme)}
      />
    </div>
  );
}

function normalizeTheme(value: string | undefined): "light" | "dark" | "cream" {
  return value === "dark" || value === "cream" ? value : "light";
}
