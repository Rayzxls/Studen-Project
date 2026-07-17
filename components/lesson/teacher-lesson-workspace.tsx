"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  Archive,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ClipboardList,
  FileText,
  Megaphone,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal, useFormStatus } from "react-dom";
import {
  createLessonAction,
  reorderLessonAction,
} from "@/app/teacher/courses/[id]/lessons/actions";

export type TeacherLessonWorkspaceItem = {
  id: string;
  title: string;
  description: string | null;
  assignmentCount: number;
  materialCount: number;
  state: "ACTIVE" | "ARCHIVED";
};

export function TeacherLessonWorkspace({
  courseId,
  courseName,
  lessons,
  canMutate,
  notice,
}: {
  courseId: string;
  courseName: string;
  lessons: TeacherLessonWorkspaceItem[];
  canMutate: boolean;
  notice?: string;
}) {
  const reduceMotion = useReducedMotion();
  const active = useMemo(
    () => lessons.filter((lesson) => lesson.state === "ACTIVE"),
    [lessons]
  );
  const archived = useMemo(
    () => lessons.filter((lesson) => lesson.state === "ARCHIVED"),
    [lessons]
  );
  const [selectedId, setSelectedId] = useState(active[0]?.id ?? "");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const selected =
    active.find((lesson) => lesson.id === selectedId) ?? active[0] ?? null;

  return (
    <section className="space-y-5 pb-16">
      {notice && (
        <p
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
          role="status"
        >
          {notice}
        </p>
      )}

      <header className="flex flex-col gap-4 border-b border-hairline pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-700">
            พื้นที่จัดบทเรียน
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">
            บทเรียนของ {courseName}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-mute">
            รวมเอกสารและการบ้านตามหัวข้อ โดย Feed เดิมยังเรียงตามเวลาเหมือนเดิม
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-ink-mute">
            {active.length} บทเรียนที่ใช้งาน
          </span>
          {canMutate && (
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-4 w-4" /> สร้างบทเรียน
            </button>
          )}
        </div>
      </header>

      {!canMutate && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          โหมดอ่านอย่างเดียว การแก้ไขบทเรียนยังไม่เปิดใช้งานในสภาพแวดล้อมนี้
        </p>
      )}

      {selected ? (
        <motion.div
          className="space-y-2"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22 }}
        >
          <p className="text-xs font-medium text-ink-mute">
            มุมครู · เลือกหัวข้อทางซ้าย แล้วเปิดพื้นที่เพื่อจัดการรายละเอียด
          </p>
          <div className="grid overflow-hidden rounded-lg border border-hairline bg-surface shadow-card md:grid-cols-[270px_minmax(0,1fr)]">
            <aside className="border-b border-hairline bg-bg/60 p-3 md:border-b-0 md:border-r">
              <p className="px-2 pb-2 text-xs font-semibold text-ink-mute">
                โครงสร้างวิชา
              </p>
              <div className="space-y-1">
                {active.map((lesson, index) => {
                  const isSelected = selected.id === lesson.id;
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => setSelectedId(lesson.id)}
                      className={`flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition ${
                        isSelected
                          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                          : "text-ink hover:bg-black/[0.04]"
                      }`}
                      aria-pressed={isSelected}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold shadow-sm ring-1 ring-hairline">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {lesson.title}
                        </span>
                        <span className="mt-1 block text-xs opacity-70">
                          {lesson.materialCount} เอกสาร ·{" "}
                          {lesson.assignmentCount} งาน
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {canMutate && (
                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-hairline px-3 py-3 text-sm font-medium text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                  onClick={() => setCreating(true)}
                >
                  <Plus className="h-4 w-4" /> เพิ่มบทเรียน
                </button>
              )}
            </aside>

            <div className="min-w-0 p-5 md:p-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={selected.id}
                  initial={reduceMotion ? false : { opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
                  transition={{ duration: reduceMotion ? 0 : 0.18 }}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-blue-700">
                        พื้นที่บทเรียน
                      </p>
                      <h3 className="mt-1 text-xl font-semibold text-ink">
                        {selected.title}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-mute">
                        {selected.description ||
                          `ยังไม่มีคำอธิบายของ ${selected.title}`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {selected.materialCount + selected.assignmentCount} รายการ
                    </span>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <WorkspaceMetric
                      icon={<FileText className="h-4 w-4" />}
                      label="เอกสาร"
                      value={selected.materialCount}
                    />
                    <WorkspaceMetric
                      icon={<ClipboardList className="h-4 w-4" />}
                      label="การบ้าน"
                      value={selected.assignmentCount}
                    />
                    <WorkspaceMetric
                      icon={<Megaphone className="h-4 w-4" />}
                      label="ประกาศวิชา"
                      value="อยู่ใน Feed"
                    />
                  </div>

                  <div className="mt-6 flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      {canMutate && (
                        <ReorderControls
                          courseId={courseId}
                          selected={selected}
                          active={active}
                        />
                      )}
                    </div>
                    <Link
                      href={`/teacher/courses/${courseId}/lessons/${selected.id}`}
                      className="btn-primary btn-sm shrink-0"
                    >
                      เปิดพื้นที่บทเรียน <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="rounded-lg border border-dashed border-hairline bg-surface px-6 py-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-ink-mute" />
          <p className="mt-3 font-medium text-ink">ยังไม่มีบทเรียน</p>
          <p className="mt-1 text-sm text-ink-mute">
            ตั้งชื่อหัวข้อแรกได้ตามแผนการสอนของคุณ
          </p>
          {canMutate && (
            <button
              type="button"
              className="btn-primary btn-sm mt-5"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-4 w-4" /> สร้างบทเรียนแรก
            </button>
          )}
        </div>
      )}

      {archived.length > 0 && (
        <div className="border-t border-hairline pt-3">
          <button
            type="button"
            className="flex w-full items-center justify-between py-2 text-left text-sm font-medium text-ink"
            onClick={() => setArchivedOpen((value) => !value)}
            aria-expanded={archivedOpen}
          >
            <span className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-ink-mute" /> บทเรียนที่จบแล้ว (
              {archived.length})
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${archivedOpen ? "rotate-180" : ""}`}
            />
          </button>
          {archivedOpen && (
            <div className="mt-2 divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
              {archived.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/teacher/courses/${courseId}/lessons/${lesson.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-ink transition hover:bg-black/[0.025]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {lesson.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-mute">
                      {lesson.materialCount} เอกสาร · {lesson.assignmentCount}{" "}
                      งาน
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-ink-mute" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      <CreateLessonDialog
        courseId={courseId}
        open={creating}
        onClose={() => setCreating(false)}
      />
    </section>
  );
}

function WorkspaceMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-bg/55 p-4">
      <span className="flex items-center gap-2 text-xs font-medium text-ink-mute">
        {icon} {label}
      </span>
      <p className="mt-3 text-lg font-semibold text-ink">{value}</p>
    </div>
  );
}

function ReorderControls({
  courseId,
  selected,
  active,
}: {
  courseId: string;
  selected: TeacherLessonWorkspaceItem;
  active: TeacherLessonWorkspaceItem[];
}) {
  const index = active.findIndex((lesson) => lesson.id === selected.id);
  return (
    <>
      <form action={reorderLessonAction}>
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="lessonId" value={selected.id} />
        <input type="hidden" name="direction" value="up" />
        <button
          type="submit"
          className="btn-ghost btn-sm"
          disabled={index <= 0}
          title="เลื่อนบทเรียนขึ้น"
          aria-label={`เลื่อน ${selected.title} ขึ้น`}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </form>
      <form action={reorderLessonAction}>
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="lessonId" value={selected.id} />
        <input type="hidden" name="direction" value="down" />
        <button
          type="submit"
          className="btn-ghost btn-sm"
          disabled={index < 0 || index >= active.length - 1}
          title="เลื่อนบทเรียนลง"
          aria-label={`เลื่อน ${selected.title} ลง`}
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </form>
    </>
  );
}

function CreateLessonDialog({
  courseId,
  open,
  onClose,
}: {
  courseId: string;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-lesson-title"
            className="w-full max-w-xl rounded-t-lg border border-hairline bg-surface p-5 shadow-2xl sm:rounded-lg sm:p-6"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3
                  id="create-lesson-title"
                  className="text-xl font-semibold text-ink"
                >
                  สร้างบทเรียนใหม่
                </h3>
                <p className="mt-1 text-sm text-ink-mute">
                  ตั้งชื่อได้อิสระตามหัวข้อหรือแผนการสอนของคุณ
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost h-9 w-9 p-0"
                onClick={onClose}
                aria-label="ปิดหน้าต่างสร้างบทเรียน"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form action={createLessonAction} className="mt-6 space-y-4">
              <input type="hidden" name="courseId" value={courseId} />
              <label className="block text-sm font-medium text-ink">
                ชื่อบทเรียน
                <input
                  name="title"
                  required
                  maxLength={120}
                  className="input mt-1.5"
                  placeholder="เช่น การทักทายและแนะนำตัว"
                  autoFocus
                />
              </label>
              <label className="block text-sm font-medium text-ink">
                คำอธิบาย{" "}
                <span className="font-normal text-ink-mute">(ไม่บังคับ)</span>
                <textarea
                  name="description"
                  maxLength={1000}
                  className="input mt-1.5 min-h-28 resize-y"
                  placeholder="นักเรียนจะได้เรียนรู้อะไรในหัวข้อนี้"
                />
              </label>
              <div className="flex justify-end gap-2 border-t border-hairline pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                >
                  ยกเลิก
                </button>
                <CreateButton />
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Plus className="h-4 w-4" />
      {pending ? "กำลังสร้าง..." : "สร้างบทเรียน"}
    </button>
  );
}
