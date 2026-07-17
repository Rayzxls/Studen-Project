"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  Circle,
  ClipboardList,
  Clock3,
  FileText,
} from "lucide-react";
import type { StudentLessonItem } from "@/lib/lesson";

export function StudentLearningPath({
  courseId,
  lessons,
}: {
  courseId: string;
  lessons: StudentLessonItem[];
}) {
  const reduceMotion = useReducedMotion();

  if (lessons.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-hairline bg-surface px-6 py-12 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-ink-mute" />
        <p className="mt-3 font-medium text-ink">ยังไม่มีบทเรียน</p>
        <p className="mt-1 text-sm text-ink-mute">
          เมื่อครูสร้างบทเรียน รายการจะปรากฏที่นี่ทันที
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0 pl-5 before:absolute before:bottom-10 before:left-[39px] before:top-10 before:w-px before:bg-hairline md:pl-8">
      {lessons.map((lesson, index) => (
        <motion.article
          key={lesson.id}
          className="relative py-3 pl-14 md:py-4"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.28,
            delay: reduceMotion ? 0 : Math.min(index * 0.07, 0.28),
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <LessonMarker lesson={lesson} index={index} />
          <Link
            href={`/student/courses/${courseId}/lessons/${lesson.id}`}
            className="group grid gap-4 rounded-lg border border-hairline bg-surface p-4 shadow-sm transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-bg md:grid-cols-[minmax(0,1fr)_220px] md:items-center md:p-5"
          >
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-blue-700">
                    จุดเรียนรู้ {String(index + 1).padStart(2, "0")}
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-ink">
                    {lesson.title}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink-mute">
                    {lesson.description ||
                      `ยังไม่มีคำอธิบายของ ${lesson.title}`}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-blue-700 transition-transform group-hover:translate-x-1" />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-mute">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {lesson.materialCount} เอกสาร
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" />
                  {lesson.assignmentCount} งาน
                </span>
              </div>

              <CheckpointRail lesson={lesson} />
            </div>

            <ProgressSummary lesson={lesson} />
          </Link>
        </motion.article>
      ))}
    </div>
  );
}

function LessonMarker({
  lesson,
  index,
}: {
  lesson: StudentLessonItem;
  index: number;
}) {
  const completed =
    lesson.assignmentCount > 0 && lesson.progressPercent === 100;
  const started = lesson.progressPercent > 0;

  return (
    <span
      className={`absolute left-0 top-7 z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-bg shadow-sm md:top-8 ${completed ? "bg-green-500 text-white" : started ? "bg-blue-500 text-white" : "bg-surface text-ink-mute ring-1 ring-hairline"}`}
      aria-hidden="true"
    >
      {completed ? (
        <Check className="h-4 w-4" />
      ) : (
        <span className="text-xs font-semibold">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
    </span>
  );
}

function CheckpointRail({ lesson }: { lesson: StudentLessonItem }) {
  const checkpoints = [
    ...lesson.materials.map((material) => ({
      id: `material-${material.id}`,
      label: material.title,
      kind: "material" as const,
      complete: false,
      overdue: false,
    })),
    ...lesson.assignments.map((assignment) => ({
      id: `assignment-${assignment.id}`,
      label: assignment.title,
      kind: "assignment" as const,
      complete: assignment.isCompleted,
      overdue: assignment.isOverdue,
    })),
  ];
  const visible = checkpoints.slice(0, 4);

  if (visible.length === 0) {
    return (
      <div className="mt-4 border-t border-hairline pt-4 text-xs text-ink-mute">
        ครูยังไม่ได้เพิ่ม checkpoint ในบทเรียนนี้
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <div
        className="relative grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))`,
        }}
      >
        {visible.length > 1 && (
          <span
            aria-hidden="true"
            className="absolute left-[12.5%] right-[12.5%] top-3 h-px bg-hairline"
          />
        )}
        {visible.map((checkpoint) => {
          const tone = checkpoint.complete
            ? "border-green-500 bg-green-500 text-white"
            : checkpoint.overdue
              ? "border-orange-500 bg-orange-50 text-orange-700"
              : checkpoint.kind === "material"
                ? "border-blue-500 bg-surface text-blue-700 ring-4 ring-blue-50"
                : "border-hairline bg-surface text-ink-mute";

          return (
            <div
              key={checkpoint.id}
              className="relative z-10 min-w-0 text-center"
            >
              <span
                className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 ${tone}`}
                aria-hidden="true"
              >
                {checkpoint.complete ? (
                  <Check className="h-3 w-3" />
                ) : checkpoint.overdue ? (
                  <Clock3 className="h-3 w-3" />
                ) : checkpoint.kind === "material" ? (
                  <FileText className="h-3 w-3" />
                ) : (
                  <Circle className="h-2.5 w-2.5" />
                )}
              </span>
              <span className="mt-2 block truncate text-[10px] text-ink-mute sm:text-xs">
                {checkpoint.label}
              </span>
            </div>
          );
        })}
      </div>
      {checkpoints.length > visible.length && (
        <p className="mt-3 text-right text-[11px] text-ink-mute">
          และอีก {checkpoints.length - visible.length} checkpoint
        </p>
      )}
    </div>
  );
}

function ProgressSummary({ lesson }: { lesson: StudentLessonItem }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="rounded-lg border border-hairline bg-bg/60 p-4">
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-mute">ความคืบหน้าของฉัน</span>
        <strong className="text-ink">{lesson.progressPercent}%</strong>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-hairline">
        <motion.div
          className="h-full rounded-full bg-blue-500"
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${lesson.progressPercent}%` }}
          transition={{
            duration: reduceMotion ? 0 : 0.45,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      </div>
      <p className="mt-3 truncate text-xs font-medium text-ink">
        {lesson.nextTask?.title ??
          (lesson.assignmentCount > 0 ? "ส่งงานครบแล้ว" : "ยังไม่มีงานในบทนี้")}
      </p>
      <p
        className={`mt-1 text-[11px] ${lesson.nextTask?.isOverdue ? "text-orange-700" : "text-ink-mute"}`}
      >
        {formatNextDue(lesson)}
      </p>
    </div>
  );
}

function formatNextDue(lesson: StudentLessonItem): string {
  if (!lesson.nextTask) return "ไม่มีงานที่ต้องทำต่อ";
  if (!lesson.nextTask.dueAt) return "ไม่กำหนดวันส่ง";
  const date = new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(lesson.nextTask.dueAt);
  return lesson.nextTask.isOverdue ? `เกินกำหนด ${date}` : `ส่งภายใน ${date}`;
}
