"use client";

import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
} from "lucide-react";

type AnatomyKey =
  | "feed"
  | "assignments"
  | "attendance"
  | "scores"
  | "overview"
  | "privacy";

const CALLOUTS: Array<{
  id: AnatomyKey;
  title: string;
  body: string;
  icon: ReactNode;
  tab?: string;
  position:
    | "left-top"
    | "left-mid"
    | "left-bottom"
    | "right-top"
    | "right-mid"
    | "right-bottom";
}> = [
  {
    id: "feed",
    title: "ฟีดห้องเรียน",
    body: "ประกาศ เอกสาร และโพสต์จากครูอยู่ในจังหวะเดียว",
    icon: <Megaphone className="h-4 w-4" />,
    tab: "ฟีด",
    position: "left-top",
  },
  {
    id: "assignments",
    title: "งานและการส่ง",
    body: "ส่งงาน แก้ไขงาน และตรวจงานต่อจากหน้าเดียวกัน",
    icon: <ClipboardCheck className="h-4 w-4" />,
    tab: "งาน",
    position: "left-mid",
  },
  {
    id: "attendance",
    title: "เช็คชื่อ",
    body: "เข้าเรียน ขาด ลา และคิดเป็น % ให้เห็นทันที",
    icon: <CalendarCheck2 className="h-4 w-4" />,
    tab: "เช็คชื่อ",
    position: "left-bottom",
  },
  {
    id: "scores",
    title: "คะแนนรายวิชา",
    body: "คะแนนและเกรดของวิชานั้น ไม่รวมให้สับสน",
    icon: <BarChart3 className="h-4 w-4" />,
    tab: "คะแนน",
    position: "right-top",
  },
  {
    id: "overview",
    title: "ภาพรวมห้อง",
    body: "Dashboard ของนักเรียนทั้งห้องสำหรับครู",
    icon: <LayoutDashboard className="h-4 w-4" />,
    tab: "ภาพรวม",
    position: "right-mid",
  },
  {
    id: "privacy",
    title: "ความเป็นส่วนตัว",
    body: "นักเรียนเห็นเฉพาะข้อมูลของตัวเอง",
    icon: <ShieldCheck className="h-4 w-4" />,
    position: "right-bottom",
  },
];

const TABS = ["ฟีด", "งาน", "สมาชิก", "เช็คชื่อ", "คะแนน", "ภาพรวม"];

export function CourseAnatomyShowcase() {
  const [active, setActive] = useState<AnatomyKey>("feed");
  const activeCallout = useMemo(
    () => CALLOUTS.find((item) => item.id === active) ?? CALLOUTS[0],
    [active]
  );

  return (
    <section
      id="overview"
      className="course-anatomy-section px-4 py-16 sm:px-6 md:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-semibold leading-[1.08] tracking-normal text-ink md:text-5xl">
            ห้องเรียนเดียว เห็นครบทุกจังหวะ
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-ink-soft">
            ฟีด งาน เช็คชื่อ คะแนน และภาพรวมถูกรวมไว้ในหน้าวิชาเดียว
            เพื่อให้ครูและนักเรียนไม่ต้องไล่หาข้อมูลหลายที่
          </p>
        </div>

        <div className="course-anatomy-shell relative mt-10 overflow-hidden rounded-[30px] border px-4 py-7 shadow-card sm:px-8 md:mt-14 md:px-10 md:py-12">
          <div aria-hidden="true" className="course-anatomy-grid" />

          <div className="relative hidden min-h-[610px] items-center justify-center lg:flex">
            {CALLOUTS.map((callout) => (
              <CalloutButton
                key={callout.id}
                item={callout}
                active={active === callout.id}
                onActivate={() => setActive(callout.id)}
              />
            ))}

            <div className="course-anatomy-line line-feed" aria-hidden="true" />
            <div
              className="course-anatomy-line line-assignments"
              aria-hidden="true"
            />
            <div
              className="course-anatomy-line line-attendance"
              aria-hidden="true"
            />
            <div
              className="course-anatomy-line line-scores"
              aria-hidden="true"
            />
            <div
              className="course-anatomy-line line-overview"
              aria-hidden="true"
            />
            <div
              className="course-anatomy-line line-privacy"
              aria-hidden="true"
            />

            <CourseMockup active={activeCallout} />
          </div>

          <div className="relative lg:hidden">
            <CourseMockup active={activeCallout} compact />
            <div className="mt-6 grid gap-2">
              {CALLOUTS.map((callout) => (
                <button
                  key={callout.id}
                  type="button"
                  onClick={() => setActive(callout.id)}
                  className={
                    "course-anatomy-mobile-callout flex items-start gap-3 rounded-2xl border p-3 text-left transition " +
                    (active === callout.id ? "is-active" : "")
                  }
                >
                  <span className="course-anatomy-callout-icon mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
                    {callout.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">
                      {callout.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-ink-mute">
                      {callout.body}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CalloutButton({
  item,
  active,
  onActivate,
}: {
  item: (typeof CALLOUTS)[number];
  active: boolean;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onActivate}
      className={
        "course-anatomy-callout absolute z-20 max-w-[230px] rounded-2xl border p-3 text-left transition " +
        "callout-" +
        item.position +
        (active ? " is-active" : "")
      }
    >
      <span className="flex items-start gap-3">
        <span className="course-anatomy-callout-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          {item.icon}
        </span>
        <span>
          <span className="block text-sm font-semibold text-ink">
            {item.title}
          </span>
          <span className="mt-1 block text-xs leading-5 text-ink-mute">
            {item.body}
          </span>
        </span>
      </span>
    </button>
  );
}

function CourseMockup({
  active,
  compact = false,
}: {
  active: (typeof CALLOUTS)[number];
  compact?: boolean;
}) {
  const activeTab = active.tab ?? "ภาพรวม";

  return (
    <div
      className={
        "course-anatomy-device relative z-10 mx-auto w-full max-w-[600px] overflow-hidden rounded-[28px] border shadow-card " +
        (compact ? "" : "scale-[0.98]")
      }
    >
      <div className="course-anatomy-cover relative h-32 overflow-hidden sm:h-40">
        <Image
          src="/landing/school-bus-banner-3d.png"
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="course-anatomy-cover-image object-cover"
        />
        <span className="absolute right-4 top-4 rounded-full bg-white/84 px-3 py-1 text-xs font-semibold text-ink-soft shadow-card">
          ปี 2569
        </span>
      </div>

      <div className="relative px-5 pb-5 pt-0 sm:px-7 sm:pb-7">
        <div className="course-anatomy-avatar -mt-9 overflow-hidden rounded-full border-[5px] shadow-card">
          <Image
            src="/landing/teacher-profile-3d.png"
            alt=""
            width={96}
            height={96}
            sizes="80px"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-ink-mute">รายวิชาที่สอน</p>
            <h3 className="mt-1 text-3xl font-semibold leading-none text-ink">
              ENG
            </h3>
            <p className="mt-2 text-sm text-ink-mute">
              ห้อง ม.4/1 · ครูประจำวิชา
            </p>
          </div>
          <div className="grid max-w-xs grid-cols-3 overflow-hidden rounded-2xl border">
            <Metric label="นักเรียน" value="32" />
            <Metric label="งาน" value="6" />
            <Metric label="เข้าเรียน" value="92%" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-1 rounded-2xl p-1 sm:grid-cols-6 course-anatomy-tabs">
          {TABS.map((tab) => (
            <span
              key={tab}
              className={
                "rounded-xl px-2 py-2 text-center text-xs font-semibold transition " +
                (tab === activeTab
                  ? "course-anatomy-tab-active"
                  : "text-ink-mute")
              }
            >
              {tab}
            </span>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
          <div className="course-anatomy-feed rounded-2xl border p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <FileText className="h-4 w-4 text-blue-500" />
                วันนี้ในห้องเรียน
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                15 คะแนน
              </span>
            </div>
            <div className="mt-4 space-y-2">
              <MiniRow title="ประกาศสอบบทที่ 3" meta="ฟีด · เมื่อเช้า" />
              <MiniRow title="แบบฝึกหัด Grammar" meta="งาน · ส่งพรุ่งนี้" />
              <MiniRow title="เช็คชื่อคาบล่าสุด" meta="92% เข้าเรียน" />
            </div>
          </div>

          <div className="course-anatomy-focus rounded-2xl border p-4">
            <div className="flex h-full flex-col justify-between gap-5">
              <div>
                <p className="text-xs font-semibold text-ink-mute">
                  กำลังชี้ให้ดู
                </p>
                <p className="mt-1 text-lg font-semibold text-ink">
                  {active.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-ink-mute">
                  {active.body}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                <Eye className="h-4 w-4" />
                เห็นข้อมูลตามสิทธิ์
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-mute">
          <CheckCircle2 className="h-4 w-4 text-green-500" />6 งาน · 15
          รายการคะแนน · เห็นเฉพาะข้อมูลที่เกี่ยวข้อง
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r px-3 py-2 text-center last:border-r-0">
      <p className="text-lg font-semibold leading-none text-ink">{value}</p>
      <p className="mt-1 text-[11px] text-ink-mute">{label}</p>
    </div>
  );
}

function MiniRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="course-anatomy-mini-row flex items-center gap-3 rounded-xl px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">
          {title}
        </span>
        <span className="block truncate text-xs text-ink-mute">{meta}</span>
      </span>
    </div>
  );
}
