"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Megaphone,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type PreviewRole = "teacher" | "student";
type PreviewTheme = "light" | "dark" | "cream";

type Lesson = {
  id: string;
  order: number;
  title: string;
  description: string;
  announcements: number;
  materials: number;
  assignments: number;
  submitted: number;
  missing: number;
  late: number;
  progress: number;
  nextTask: string;
  due: string;
  archived?: boolean;
};

const initialLessons: Lesson[] = [
  {
    id: "lesson-1",
    order: 1,
    title: "พื้นฐานการสื่อสาร",
    description: "คำศัพท์ โครงสร้างประโยค และแบบฝึกหัดก่อนเริ่มบทเรียน",
    announcements: 1,
    materials: 2,
    assignments: 2,
    submitted: 24,
    missing: 4,
    late: 2,
    progress: 72,
    nextTask: "แบบฝึกหัด Grammar",
    due: "ส่งพรุ่งนี้ 16:30",
  },
  {
    id: "lesson-2",
    order: 2,
    title: "Daily Routine",
    description: "อ่านบทสนทนา ฝึกฟัง และส่งคลิปแนะนำกิจวัตรประจำวัน",
    announcements: 0,
    materials: 3,
    assignments: 1,
    submitted: 18,
    missing: 10,
    late: 1,
    progress: 48,
    nextTask: "คลิป My Daily Routine",
    due: "เหลือ 3 วัน",
  },
  {
    id: "lesson-3",
    order: 3,
    title: "Project: My Community",
    description: "งานกลุ่มสรุปสถานที่สำคัญ พร้อมนำเสนอหน้าชั้นเรียน",
    announcements: 0,
    materials: 0,
    assignments: 0,
    submitted: 0,
    missing: 0,
    late: 0,
    progress: 0,
    nextTask: "ยังไม่มีงานในบทเรียนนี้",
    due: "ยังไม่กำหนด",
  },
  {
    id: "lesson-old",
    order: 0,
    title: "เนื้อหาเดิม",
    description: "รายการที่ย้ายมาจาก Feed ก่อนเริ่มใช้ระบบบทเรียน",
    announcements: 2,
    materials: 4,
    assignments: 2,
    submitted: 28,
    missing: 0,
    late: 0,
    progress: 100,
    nextTask: "เรียนจบแล้ว",
    due: "ปิดบทเรียน",
    archived: true,
  },
];

export function LessonWorkspacePrototype({
  courseId,
  courseName,
  initialRole,
  initialTheme,
}: {
  courseId: string;
  courseName: string;
  initialRole: PreviewRole;
  initialTheme: PreviewTheme;
}) {
  const [role, setRole] = useState(initialRole);
  const [theme, setTheme] = useState(initialTheme);
  const [lessons, setLessons] = useState(initialLessons);
  const [selectedId, setSelectedId] = useState("lesson-1");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const active = lessons.filter((lesson) => !lesson.archived);
  const archived = lessons.filter((lesson) => lesson.archived);
  const selected =
    lessons.find((lesson) => lesson.id === selectedId) ?? active[0];

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = theme;
    return () => {
      if (previous) root.dataset.theme = previous;
      else delete root.dataset.theme;
    };
  }, [theme]);

  function updateQuery(
    next: Partial<{ role: PreviewRole; theme: PreviewTheme }>
  ) {
    const url = new URL(window.location.href);
    url.searchParams.delete("variant");
    if (next.role) url.searchParams.set("role", next.role);
    if (next.theme) url.searchParams.set("theme", next.theme);
    window.history.replaceState({}, "", url);
  }

  function createLesson() {
    const title = newTitle.trim();
    if (!title) return;
    const lesson: Lesson = {
      id: `lesson-${Date.now()}`,
      order: active.length + 1,
      title,
      description:
        newDescription.trim() || "พร้อมเพิ่มประกาศ เอกสาร และการบ้าน",
      announcements: 0,
      materials: 0,
      assignments: 0,
      submitted: 0,
      missing: 0,
      late: 0,
      progress: 0,
      nextTask: "ยังไม่มีงานในบทเรียนนี้",
      due: "ยังไม่กำหนด",
    };
    setLessons((items) => [...items, lesson]);
    setSelectedId(lesson.id);
    setNewTitle("");
    setNewDescription("");
    setCreating(false);
  }

  return (
    <section className="space-y-5 pb-24">
      <div className="flex flex-col gap-4 border-b border-hairline pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-700">
            ต้นแบบ · ข้อมูลจำลอง
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">
            บทเรียนของ {courseName}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-mute">
            จัดประกาศ เอกสาร งาน และความคืบหน้าไว้ในบริบทเดียว โดย Feed
            เดิมยังคงอยู่
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={role}
            options={[
              { value: "teacher", label: "มุมครู" },
              { value: "student", label: "มุมนักเรียน" },
            ]}
            onChange={(value) => {
              setRole(value);
              updateQuery({ role: value });
            }}
          />
          <Segmented
            value={theme}
            options={[
              { value: "light", label: "สว่าง" },
              { value: "dark", label: "มืด" },
              { value: "cream", label: "ครีม" },
            ]}
            onChange={(value) => {
              setTheme(value);
              updateQuery({ theme: value });
            }}
          />
          {role === "teacher" && (
            <button
              className="btn-primary btn-sm"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-4 w-4" /> สร้างบทเรียน
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={role}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          {role === "teacher" ? (
            <SplitWorkspace
              courseId={courseId}
              lessons={active}
              selected={selected}
              role={role}
              theme={theme}
              onSelect={setSelectedId}
            />
          ) : (
            <CurriculumTimeline
              lessons={active}
              role={role}
              onSelect={setSelectedId}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <div className="border-t border-hairline pt-3">
        <button
          className="flex w-full items-center justify-between py-2 text-left text-sm font-medium text-ink"
          onClick={() => setArchivedOpen((value) => !value)}
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
          <div className="mt-2 space-y-2 opacity-75">
            {archived.map((lesson) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                role={role}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        )}
      </div>

      <CreateLessonDialog
        open={creating}
        title={newTitle}
        description={newDescription}
        onTitleChange={setNewTitle}
        onDescriptionChange={setNewDescription}
        onClose={() => setCreating(false)}
        onSubmit={createLesson}
      />
    </section>
  );
}

function LessonRow({
  lesson,
  role,
  onSelect,
}: {
  lesson: Lesson;
  role: PreviewRole;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(lesson.id)}
      className="group grid w-full gap-4 rounded-lg border border-hairline bg-surface p-4 text-left shadow-sm transition hover:border-blue-500/40 hover:shadow-card md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
    >
      <div className="flex min-w-0 gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 font-semibold text-blue-700">
          {lesson.order || <Archive className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-ink">{lesson.title}</h3>
          <p className="mt-0.5 line-clamp-1 text-sm text-ink-mute">
            {lesson.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-mute">
            <span>{lesson.announcements} ประกาศ</span>
            <span>{lesson.materials} เอกสาร</span>
            <span>{lesson.assignments} งาน</span>
          </div>
        </div>
      </div>
      <RoleMetric lesson={lesson} role={role} compact />
      <ChevronRight className="hidden h-5 w-5 text-ink-mute transition group-hover:translate-x-1 md:block" />
    </button>
  );
}

function SplitWorkspace({
  courseId,
  lessons,
  selected,
  role,
  theme,
  onSelect,
}: {
  courseId: string;
  lessons: Lesson[];
  selected: Lesson;
  role: PreviewRole;
  theme: PreviewTheme;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink-mute">
        มุมครู · เลือกหัวข้อทางซ้าย แล้วจัดการเนื้อหาในพื้นที่เดียว
      </p>
      <div className="grid overflow-hidden rounded-lg border border-hairline bg-surface shadow-sm md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-hairline bg-bg/60 p-3 md:border-b-0 md:border-r">
          <p className="px-2 pb-2 text-xs font-semibold text-ink-mute">
            โครงสร้างวิชา
          </p>
          <div className="space-y-1">
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => onSelect(lesson.id)}
                className={`w-full rounded-md px-3 py-3 text-left transition ${selected.id === lesson.id ? "bg-blue-50 text-blue-700" : "text-ink hover:bg-black/[0.04]"}`}
              >
                <span className="block truncate text-sm font-semibold">
                  {lesson.title}
                </span>
                <span className="mt-1 block text-xs opacity-70">
                  {lesson.materials} เอกสาร · {lesson.assignments} งาน
                </span>
              </button>
            ))}
          </div>
        </aside>
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-700">
                พื้นที่บทเรียน
              </p>
              <h3 className="mt-1 text-xl font-semibold text-ink">
                {selected.title}
              </h3>
              <p className="mt-1 text-sm text-ink-mute">
                {selected.description}
              </p>
            </div>
            <RoleMetric lesson={selected} role={role} />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <WorkspaceSection
              icon={<Megaphone />}
              title="ประกาศ"
              count={selected.announcements}
              empty="ยังไม่มีประกาศ"
            />
            <WorkspaceSection
              icon={<FileText />}
              title="เอกสาร"
              count={selected.materials}
              empty="ยังไม่มีเอกสาร"
            />
            <WorkspaceSection
              icon={<ClipboardCheck />}
              title="การบ้าน"
              count={selected.assignments}
              empty="ยังไม่มีการบ้าน"
            />
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-mute">
              เปิดเพื่อจัดการเนื้อหา งานรอตรวจ และรายละเอียดทั้งหมดของหัวข้อนี้
            </p>
            <Link
              href={`/teacher/courses/${courseId}/lessons-prototype/${selected.id}?role=teacher&theme=${theme}`}
              className="btn-primary btn-sm shrink-0"
            >
              เปิดพื้นที่บทเรียน <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function CurriculumTimeline({
  lessons,
  role,
  onSelect,
}: {
  lessons: Lesson[];
  role: PreviewRole;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink-mute">
        เส้นทางของฉัน · แต่ละหัวข้อมี checkpoint
        บอกสิ่งที่ทำสำเร็จและสิ่งที่ต้องทำต่อ
      </p>
      <div className="relative space-y-0 pl-5 before:absolute before:bottom-8 before:left-[39px] before:top-8 before:w-px before:bg-hairline md:pl-8">
        {lessons.map((lesson, index) => (
          <motion.button
            key={lesson.id}
            onClick={() => onSelect(lesson.id)}
            className="relative grid w-full gap-4 py-4 pl-14 text-left md:grid-cols-[minmax(0,1fr)_220px] md:items-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <span
              className={`absolute left-0 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full border-4 border-bg shadow-sm ${lesson.progress >= 100 ? "bg-green-500 text-white" : lesson.progress > 0 ? "bg-blue-500 text-white" : "bg-surface text-ink-mute ring-1 ring-hairline"}`}
            >
              {lesson.progress >= 100 ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-current" />
              )}
            </span>
            <div className="rounded-lg border border-hairline bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{lesson.title}</h3>
                  <p className="mt-1 text-sm text-ink-mute">
                    {lesson.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-blue-700" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-mute">
                <span>{lesson.materials} เอกสาร</span>
                <span>·</span>
                <span>{lesson.assignments} งาน</span>
              </div>
              <CheckpointRail lesson={lesson} />
            </div>
            <RoleMetric lesson={lesson} role={role} />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function CheckpointRail({ lesson }: { lesson: Lesson }) {
  const labels = checkpointLabels(lesson.id);
  const completed =
    lesson.progress >= 100
      ? 3
      : lesson.progress >= 50
        ? 2
        : lesson.progress > 0
          ? 1
          : 0;

  return (
    <div className="mt-4 border-t border-hairline pt-4">
      <div className="relative grid grid-cols-3 gap-2 before:absolute before:left-[16.66%] before:right-[16.66%] before:top-3 before:h-px before:bg-hairline">
        {labels.map((label, index) => {
          const done = index < completed;
          const current = index === completed && completed < labels.length;
          return (
            <div key={label} className="relative z-10 min-w-0 text-center">
              <span
                className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 ${done ? "border-green-500 bg-green-500 text-white" : current ? "border-blue-500 bg-surface text-blue-700 ring-4 ring-blue-50" : "border-hairline bg-surface text-ink-mute"}`}
              >
                {done ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              <span
                className={`mt-2 block truncate text-[10px] md:text-xs ${done || current ? "font-medium text-ink" : "text-ink-mute"}`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function checkpointLabels(lessonId: string): [string, string, string] {
  if (lessonId === "lesson-1")
    return ["อ่านคำศัพท์", "ฝึก Grammar", "ส่งแบบฝึกหัด"];
  if (lessonId === "lesson-2") return ["อ่านบทสนทนา", "ฝึกฟัง", "ส่งคลิป"];
  if (lessonId === "lesson-3") return ["เลือกสถานที่", "ทำงานกลุ่ม", "นำเสนอ"];
  return ["อ่านเนื้อหา", "ฝึกทำ", "ส่งงาน"];
}

function RoleMetric({
  lesson,
  role,
  compact = false,
}: {
  lesson: Lesson;
  role: PreviewRole;
  compact?: boolean;
}) {
  if (role === "teacher") {
    return (
      <div
        className={`flex shrink-0 items-center gap-3 ${compact ? "md:justify-end" : "rounded-lg bg-bg/70 px-4 py-3"}`}
      >
        <Metric value={lesson.submitted} label="ส่งแล้ว" tone="green" />
        <Metric
          value={lesson.missing}
          label="ยังไม่ส่ง"
          tone={lesson.missing ? "orange" : "muted"}
        />
        <Metric
          value={lesson.late}
          label="ส่งสาย"
          tone={lesson.late ? "red" : "muted"}
        />
      </div>
    );
  }
  return (
    <div
      className={`${compact ? "md:w-48" : "w-full max-w-[230px] rounded-lg bg-bg/70 px-4 py-3"}`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-mute">ความคืบหน้าของฉัน</span>
        <strong className="text-ink">{lesson.progress}%</strong>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-hairline">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${lesson.progress}%` }}
        />
      </div>
      <p className="mt-2 truncate text-xs font-medium text-ink">
        {lesson.nextTask}
      </p>
      <p className="mt-0.5 text-[11px] text-orange-700">{lesson.due}</p>
    </div>
  );
}

function Metric({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "green" | "orange" | "red" | "muted";
}) {
  const color =
    tone === "green"
      ? "text-green-700"
      : tone === "orange"
        ? "text-orange-700"
        : tone === "red"
          ? "text-red-700"
          : "text-ink-mute";
  return (
    <span className="min-w-11 text-center">
      <strong className={`block text-base ${color}`}>{value}</strong>
      <span className="text-[10px] text-ink-mute">{label}</span>
    </span>
  );
}

function WorkspaceSection({
  icon,
  title,
  count,
  empty,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  empty: string;
}) {
  return (
    <button className="rounded-lg border border-hairline bg-bg/40 p-4 text-left transition hover:border-blue-500/40 hover:bg-blue-50/40">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface text-blue-700 [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <span className="mt-3 block text-sm font-semibold text-ink">{title}</span>
      <span className="mt-1 block text-xs text-ink-mute">
        {count ? `${count} รายการ` : empty}
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-hairline bg-surface p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${value === option.value ? "bg-blue-50 text-blue-700 shadow-sm" : "text-ink-mute hover:text-ink"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CreateLessonDialog({
  open,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
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
            className="w-full max-w-md rounded-lg border border-hairline bg-surface p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-700">
                  หัวข้อใหม่
                </p>
                <h3
                  id="create-lesson-title"
                  className="mt-1 text-xl font-semibold text-ink"
                >
                  สร้างพื้นที่บทเรียน
                </h3>
                <p className="mt-1 text-sm text-ink-mute">
                  ครูตั้งชื่อได้อย่างอิสระ ระบบไม่เติมคำว่า “บทที่” ให้อัตโนมัติ
                </p>
              </div>
              <button className="btn-icon" onClick={onClose} aria-label="ปิด">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-5 block text-sm font-medium text-ink">
              ชื่อหัวข้อ <span className="text-red-700">*</span>
            </label>
            <input
              autoFocus
              className="input mt-2 w-full"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSubmit();
              }}
              placeholder="เช่น Present Simple หรือ โปรเจกต์ชุมชนของฉัน"
            />
            <label className="mt-4 block text-sm font-medium text-ink">
              คำอธิบาย{" "}
              <span className="font-normal text-ink-mute">(ไม่บังคับ)</span>
            </label>
            <textarea
              className="input mt-2 min-h-24 w-full resize-none"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="สรุปว่านักเรียนจะเรียนหรือทำอะไรในหัวข้อนี้"
            />
            <p className="mt-2 text-xs text-ink-mute">
              ระบบเก็บลำดับไว้สำหรับจัดเส้นทาง แต่ไม่บังคับรูปแบบชื่อของครู
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button className="btn-secondary btn-sm" onClick={onClose}>
                ยกเลิก
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={onSubmit}
                disabled={!title.trim()}
              >
                <Plus className="h-4 w-4" /> สร้างบทเรียน
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
