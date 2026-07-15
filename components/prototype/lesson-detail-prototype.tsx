"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BellRing,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";

type PreviewTheme = "light" | "dark" | "cream";

const lessonDetails: Record<string, { title: string; description: string }> = {
  "lesson-1": {
    title: "พื้นฐานการสื่อสาร",
    description: "คำศัพท์ โครงสร้างประโยค และแบบฝึกหัดก่อนเริ่มบทเรียน",
  },
  "lesson-2": {
    title: "Daily Routine",
    description: "อ่านบทสนทนา ฝึกฟัง และส่งคลิปแนะนำกิจวัตรประจำวัน",
  },
  "lesson-3": {
    title: "Project: My Community",
    description: "งานกลุ่มสรุปสถานที่สำคัญ พร้อมนำเสนอหน้าชั้นเรียน",
  },
};

export function LessonDetailPrototype({
  courseId,
  lessonId,
  theme,
}: {
  courseId: string;
  lessonId: string;
  theme: PreviewTheme;
}) {
  const lesson = lessonDetails[lessonId] ?? {
    title: "สำนวนในชีวิตประจำวัน",
    description: "ฝึกใช้สำนวนผ่านบทสนทนาและสถานการณ์จำลอง",
  };

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = theme;
    return () => {
      if (previous) root.dataset.theme = previous;
      else delete root.dataset.theme;
    };
  }, [theme]);

  const backHref = `/teacher/courses/${courseId}/lessons-prototype?role=teacher&theme=${theme}`;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-16 md:px-6 md:py-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm text-ink-mute hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" /> บทเรียนทั้งหมด
      </Link>

      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-hairline pb-6"
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge">ENG</span>
              <span className="badge-success">เปิดใช้งาน</span>
              <span className="text-xs text-ink-mute">
                Prototype · ไม่บันทึกข้อมูล
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">
              {lesson.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-mute md:text-base">
              {lesson.description}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-sm">
              <Pencil className="h-4 w-4" /> แก้ไขข้อมูล
            </button>
            <button className="btn-icon" aria-label="ตัวเลือกบทเรียน">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>
      </motion.header>

      <section className="grid grid-cols-2 border-y border-hairline md:grid-cols-4">
        <SummaryStat icon={<BookOpen />} value="3" label="รายการเนื้อหา" />
        <SummaryStat icon={<ClipboardCheck />} value="2" label="การบ้าน" />
        <SummaryStat icon={<Clock3 />} value="6" label="งานรอตรวจ" alert />
        <SummaryStat
          icon={<BarChart3 />}
          value="72%"
          label="ความคืบหน้าเฉลี่ย"
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-9">
          <ContentSection
            icon={<BellRing />}
            title="ประกาศ"
            description="ข้อความที่เกี่ยวข้องกับหัวข้อนี้เท่านั้น"
            action="เพิ่มประกาศ"
          >
            <ContentRow
              title="เตรียมสอบคำศัพท์ท้ายคาบ"
              meta="โพสต์เมื่อ 2 ชั่วโมงที่ผ่านมา · นักเรียนเห็นแล้ว 24 คน"
              badge="ประกาศล่าสุด"
            />
          </ContentSection>

          <ContentSection
            icon={<FileText />}
            title="เอกสารประกอบ"
            description="เอกสารและลิงก์ที่นักเรียนใช้เรียนในหัวข้อนี้"
            action="เพิ่มเอกสาร"
          >
            <ContentRow
              title="Vocabulary Starter.pdf"
              meta="PDF · 2.4 MB · อัปเดตเมื่อวาน"
            />
            <ContentRow
              title="คลิปทบทวนโครงสร้างประโยค"
              meta="ลิงก์ YouTube · 08:42 นาที"
            />
          </ContentSection>

          <ContentSection
            icon={<ClipboardCheck />}
            title="การบ้าน"
            description="งาน คะแนน และสถานะการส่งภายในหัวข้อนี้"
            action="สร้างการบ้าน"
          >
            <AssignmentRow
              title="แบบฝึกหัด Grammar"
              due="กำหนดส่งพรุ่งนี้ 16:30"
              score="10 คะแนน"
              submitted={24}
              missing={4}
              pending={6}
            />
            <AssignmentRow
              title="Speaking Practice"
              due="กำหนดส่งในอีก 4 วัน"
              score="15 คะแนน"
              submitted={18}
              missing={10}
              pending={3}
            />
          </ContentSection>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-lg border border-orange-500/25 bg-orange-50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-orange-700">
                  ต้องจัดการ
                </p>
                <h2 className="mt-1 text-lg font-semibold text-ink">
                  งานรอตรวจ 6 ชิ้น
                </h2>
              </div>
              <Clock3 className="h-5 w-5 text-orange-700" />
            </div>
            <p className="mt-2 text-sm text-ink-mute">
              มีงานส่งสาย 2 ชิ้น ควรตรวจให้เสร็จก่อนประกาศคะแนน
            </p>
            <button className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-orange-700">
              ไปหน้าตรวจงาน <ArrowRight className="h-4 w-4" />
            </button>
          </section>

          <section className="rounded-lg border border-hairline bg-surface p-5">
            <h2 className="font-semibold text-ink">นักเรียนในหัวข้อนี้</h2>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-3xl font-semibold text-ink">28</span>
              <span className="text-xs text-ink-mute">คน</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-hairline">
              <div className="h-full w-[72%] rounded-full bg-blue-500" />
            </div>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-ink-mute">ความคืบหน้าเฉลี่ย</span>
              <strong className="text-blue-700">72%</strong>
            </div>
          </section>

          <section className="border-t border-hairline pt-5 text-sm">
            <h2 className="font-semibold text-ink">จัดการบทเรียน</h2>
            <button className="mt-3 flex w-full items-center justify-between py-2 text-left text-ink-mute hover:text-ink">
              <span>จัดลำดับเนื้อหา</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button className="flex w-full items-center justify-between py-2 text-left text-ink-mute hover:text-ink">
              <span>ย้ายรายการเข้าบทเรียน</span>
              <ChevronRight className="h-4 w-4" />
            </button>
            <button className="flex w-full items-center justify-between py-2 text-left text-ink-mute hover:text-ink">
              <span>เก็บบทเรียนถาวร</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </section>
        </aside>
      </div>
    </main>
  );
}

function SummaryStat({
  icon,
  value,
  label,
  alert = false,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  alert?: boolean;
}) {
  return (
    <div className="flex min-h-24 items-center gap-3 border-b border-r border-hairline p-4 last:border-r-0 md:border-b-0">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4 ${alert ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}
      >
        {icon}
      </span>
      <span>
        <strong
          className={`block text-xl ${alert ? "text-orange-700" : "text-ink"}`}
        >
          {value}
        </strong>
        <span className="text-xs text-ink-mute">{label}</span>
      </span>
    </div>
  );
}

function ContentSection({
  icon,
  title,
  description,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-col gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-blue-700 [&>svg]:h-5 [&>svg]:w-5">
            {icon}
          </span>
          <div>
            <h2 className="font-semibold text-ink">{title}</h2>
            <p className="mt-0.5 text-xs text-ink-mute">{description}</p>
          </div>
        </div>
        <button className="btn-secondary btn-sm self-start">
          <Plus className="h-4 w-4" /> {action}
        </button>
      </div>
      <div className="divide-y divide-hairline">{children}</div>
    </section>
  );
}

function ContentRow({
  title,
  meta,
  badge,
}: {
  title: string;
  meta: string;
  badge?: string;
}) {
  return (
    <button className="group flex w-full items-center justify-between gap-4 py-4 text-left">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
          {badge && <span className="badge-info">{badge}</span>}
        </div>
        <p className="mt-1 text-xs text-ink-mute">{meta}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-mute transition group-hover:translate-x-1 group-hover:text-blue-700" />
    </button>
  );
}

function AssignmentRow({
  title,
  due,
  score,
  submitted,
  missing,
  pending,
}: {
  title: string;
  due: string;
  score: string;
  submitted: number;
  missing: number;
  pending: number;
}) {
  return (
    <div className="py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-ink">{title}</h3>
          <p className="mt-1 text-xs text-ink-mute">
            {due} · {score}
          </p>
        </div>
        <button className="btn-secondary btn-sm">
          เปิดงาน <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 rounded-lg bg-bg/60 p-3 text-center">
        <MiniStat value={submitted} label="ส่งแล้ว" tone="green" />
        <MiniStat value={missing} label="ยังไม่ส่ง" tone="muted" />
        <MiniStat value={pending} label="รอตรวจ" tone="orange" />
      </div>
    </div>
  );
}

function MiniStat({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "green" | "orange" | "muted";
}) {
  const color =
    tone === "green"
      ? "text-green-700"
      : tone === "orange"
        ? "text-orange-700"
        : "text-ink";
  return (
    <span>
      <strong className={`block text-lg ${color}`}>{value}</strong>
      <span className="text-[11px] text-ink-mute">{label}</span>
    </span>
  );
}
