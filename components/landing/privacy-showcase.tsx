"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileLock2,
  GraduationCap,
  LockKeyhole,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";

type LensRole = "student" | "teacher" | "admin";

const ROLE_OPTIONS: Array<{
  id: LensRole;
  label: string;
  title: string;
  caption: string;
  icon: ReactNode;
}> = [
  {
    id: "student",
    label: "นักเรียน",
    title: "รายวินทร์ · นักเรียน ม.4/2",
    caption: "เห็นเฉพาะงาน คะแนน และประกาศของตัวเอง",
    icon: <GraduationCap className="h-4 w-4" />,
  },
  {
    id: "teacher",
    label: "ครู",
    title: "ครูประจำวิชา · ENG",
    caption: "จัดการเฉพาะห้องที่ตัวเองสอน",
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: "admin",
    label: "ผู้ดูแล",
    title: "Admin Observer",
    caption: "ตรวจภาพรวมและ audit แบบ read-only",
    icon: <UserCog className="h-4 w-4" />,
  },
];

const VISIBILITY_ROWS: Record<
  LensRole,
  Array<{ label: string; allowed: boolean; note: string }>
> = {
  student: [
    {
      label: "คะแนนและผลตรวจของฉัน",
      allowed: true,
      note: "เปิดดูได้ทันที",
    },
    {
      label: "ตารางเรียนและประกาศของห้อง",
      allowed: true,
      note: "เห็นเฉพาะห้องที่เข้าร่วม",
    },
    {
      label: "งานที่ฉันส่งและประวัติส่งงาน",
      allowed: true,
      note: "แนบไฟล์ผ่าน signed URL",
    },
    {
      label: "คะแนนของเพื่อนร่วมห้อง",
      allowed: false,
      note: "ถูกซ่อนไว้",
    },
    {
      label: "ไฟล์งานที่เพื่อนส่ง",
      allowed: false,
      note: "ไม่มีสิทธิ์เข้าถึง",
    },
  ],
  teacher: [
    {
      label: "งานค้างตรวจของวิชาที่สอน",
      allowed: true,
      note: "รวมในหน้าตรวจงาน",
    },
    {
      label: "คะแนนและการเข้าเรียนของห้อง",
      allowed: true,
      note: "แก้ไขได้ตามสิทธิ์ครู",
    },
    {
      label: "คอมเมนต์ส่วนตัวกับนักเรียน",
      allowed: true,
      note: "เห็นเฉพาะคู่สนทนา",
    },
    {
      label: "ห้องเรียนของครูคนอื่น",
      allowed: false,
      note: "ไม่แสดงในพื้นที่ครู",
    },
    {
      label: "เครื่องมือจัดการผู้ใช้ระดับระบบ",
      allowed: false,
      note: "สงวนให้ Admin",
    },
  ],
  admin: [
    {
      label: "ภาพรวมผู้ใช้ ห้องเรียน และ activity",
      allowed: true,
      note: "สำหรับตรวจสอบระบบ",
    },
    {
      label: "Audit log การแก้คะแนนและไฟล์",
      allowed: true,
      note: "บันทึกย้อนหลัง",
    },
    {
      label: "นำเข้าข้อมูลและจัดการรหัสผ่าน",
      allowed: true,
      note: "เฉพาะงานระบบ",
    },
    {
      label: "แก้คะแนนแทนครู",
      allowed: false,
      note: "read-only observer",
    },
    {
      label: "เข้าถึงไฟล์แบบ public URL",
      allowed: false,
      note: "ใช้ signed URL เท่านั้น",
    },
  ],
};

const TRUST_POINTS = [
  {
    icon: <ScrollText className="h-3.5 w-3.5" />,
    label: "Audit log ทุกการแก้ไข",
  },
  {
    icon: <FileLock2 className="h-3.5 w-3.5" />,
    label: "ไฟล์ผ่าน Signed URL",
  },
  {
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    label: "พร้อมตาม PDPA",
  },
];

/**
 * PrivacyShowcase — a single landing-page section.
 *
 * This section is intentionally theme-aware and self-contained: light, dark,
 * and cream modes all use the same privacy lens interaction without forcing
 * the rest of the landing page into a dark-only band.
 */
export function PrivacyShowcase() {
  const [role, setRole] = useState<LensRole>("student");
  const activeRole = useMemo(
    () => ROLE_OPTIONS.find((item) => item.id === role) ?? ROLE_OPTIONS[0],
    [role]
  );
  const rows = VISIBILITY_ROWS[role];
  const visibleCount = rows.filter((row) => row.allowed).length;

  return (
    <section id="privacy" className="px-4 py-16 sm:px-6 md:py-24">
      <div className="privacy-showcase relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border px-5 py-8 shadow-card sm:px-8 md:rounded-[34px] md:px-14 md:py-16">
        <div aria-hidden="true" className="privacy-grid" />
        <div aria-hidden="true" className="privacy-scan-line" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold privacy-kicker">
              <ShieldCheck className="h-3.5 w-3.5" />
              ออกแบบโดยให้ความเป็นส่วนตัวมาก่อน
            </div>

            <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.07] tracking-normal privacy-title sm:text-5xl">
              เห็นเฉพาะสิ่งที่
              <br />
              ควรเห็นเท่านั้น
            </h2>

            <p className="mt-5 max-w-lg text-base leading-8 privacy-copy">
              นักเรียนเห็นข้อมูลของตัวเอง ครูเห็นเฉพาะห้องที่สอน และผู้ดูแลดู
              audit ได้โดยไม่แก้ข้อมูลแทนครู ทุกไฟล์เข้าถึงผ่านลิงก์ที่มีอายุ
              และทุกการแก้ไขถูกบันทึกไว้เสมอ
            </p>

            <div className="mt-8 flex flex-wrap gap-2.5">
              {TRUST_POINTS.map((point) => (
                <TrustPill
                  key={point.label}
                  icon={point.icon}
                  label={point.label}
                />
              ))}
            </div>
          </div>

          <div className="privacy-lens-panel relative overflow-hidden rounded-[24px] border p-4 sm:p-5">
            <div aria-hidden="true" className="privacy-panel-sheen" />

            <div className="relative flex flex-wrap gap-2 rounded-2xl p-1 privacy-role-tabs">
              {ROLE_OPTIONS.map((item) => {
                const active = item.id === role;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRole(item.id)}
                    className={
                      "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3 sm:text-sm " +
                      (active ? "privacy-role-tab-active" : "privacy-role-tab")
                    }
                    aria-pressed={active}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="relative mt-5 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="privacy-avatar flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                  {role === "student"
                    ? "รย"
                    : role === "teacher"
                      ? "ครู"
                      : "AD"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold privacy-panel-title">
                    {activeRole.title}
                  </p>
                  <p className="mt-0.5 text-xs privacy-muted">
                    {activeRole.caption}
                  </p>
                </div>
              </div>

              <div className="privacy-count rounded-2xl px-3 py-2 text-right">
                <p className="text-xl font-semibold leading-none">
                  {visibleCount}
                </p>
                <p className="mt-1 text-[11px]">รายการที่เห็นได้</p>
              </div>
            </div>

            <div className="relative mt-5 space-y-2.5">
              {rows.map((row, index) => (
                <VisibilityRow
                  key={row.label}
                  label={row.label}
                  note={row.note}
                  allowed={row.allowed}
                  index={index}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="privacy-trust-pill inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold">
      <span>{icon}</span>
      {label}
    </span>
  );
}

function VisibilityRow({
  label,
  note,
  allowed,
  index,
}: {
  label: string;
  note: string;
  allowed: boolean;
  index: number;
}) {
  return (
    <div
      className={
        "privacy-row group flex items-center gap-3 rounded-2xl border px-3 py-3.5 transition " +
        (allowed ? "privacy-row-allowed" : "privacy-row-denied")
      }
      style={{ animationDelay: `${index * 28}ms` }}
    >
      <span className="privacy-row-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
        {allowed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs privacy-row-note">
          {allowed ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <LockKeyhole className="h-3.5 w-3.5" />
          )}
          {note}
        </span>
      </span>
    </div>
  );
}
