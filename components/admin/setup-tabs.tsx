"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Copy,
  GraduationCap,
  Layers,
  Plus,
  Trash2,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  createAcademicYearAction,
  createClassAction,
  createSingleTeacherAction,
  createTermAction,
  deleteAcademicYearAction,
  deleteClassAction,
  deleteTermAction,
  type CreateAcademicYearState,
  type CreateClassState,
  type CreateSingleTeacherState,
  type CreateTermState,
  type DeleteAcademicYearState,
  type DeleteClassState,
  type DeleteTermState,
} from "@/app/admin/setup/actions";

// ─────────────────────────────────────────────────────────────
// Types — shapes returned from page server-side
// ─────────────────────────────────────────────────────────────

export interface SetupData {
  years: Array<{
    id: string;
    name: string;
    isActive: boolean;
    _count: { terms: number; classes: number };
  }>;
  terms: Array<{
    id: string;
    name: string;
    number: number;
    isActive: boolean;
    startDate: Date;
    endDate: Date;
    academicYear: { id: string; name: string };
    _count: { courses: number };
  }>;
  classes: Array<{
    id: string;
    name: string;
    gradeLevel: string;
    academicYear: { id: string; name: string };
    homeroomTeacher: {
      userId: string;
      firstName: string;
      lastName: string;
    } | null;
    _count: { students: number; courses: number };
  }>;
  teachers: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    homeroomOf: { id: string; name: string } | null;
  }>;
}

type TabKey = "years" | "terms" | "classes" | "teachers";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "years", label: "ปีการศึกษา", icon: Calendar },
  { key: "terms", label: "ภาคเรียน", icon: Layers },
  { key: "classes", label: "ห้องเรียน", icon: GraduationCap },
  { key: "teachers", label: "ครู (เพิ่มรายคน)", icon: UserPlus },
];

const INITIAL_AY: CreateAcademicYearState = {};
const INITIAL_TERM: CreateTermState = {};
const INITIAL_CLASS: CreateClassState = {};
const INITIAL_TEACHER: CreateSingleTeacherState = {};
const INITIAL_DEL_AY: DeleteAcademicYearState = {};
const INITIAL_DEL_TERM: DeleteTermState = {};
const INITIAL_DEL_CLASS: DeleteClassState = {};

export function SetupTabs({
  activeTab,
  data,
}: {
  activeTab: TabKey;
  data: SetupData;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function switchTab(tab: TabKey) {
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", tab);
    router.replace(`/admin/setup?${sp.toString()}`);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-1 border-b border-black/[0.06]">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = key === activeTab;
          return (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={
                "flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition-colors " +
                (active
                  ? "border-black text-black"
                  : "border-transparent text-black/50 hover:text-black")
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>
      {activeTab === "years" && <YearsTab years={data.years} />}
      {activeTab === "terms" && (
        <TermsTab years={data.years} terms={data.terms} />
      )}
      {activeTab === "classes" && (
        <ClassesTab
          years={data.years}
          classes={data.classes}
          teachers={data.teachers}
        />
      )}
      {activeTab === "teachers" && <TeachersTab teachers={data.teachers} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Years tab
// ─────────────────────────────────────────────────────────────

function YearsTab({ years }: { years: SetupData["years"] }) {
  const [state, action] = useActionState(createAcademicYearAction, INITIAL_AY);
  const [delState, delAction] = useActionState(
    deleteAcademicYearAction,
    INITIAL_DEL_AY
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-medium text-black/80">
          เพิ่มปีการศึกษา
        </h2>
        <form ref={formRef} action={action} className="flex flex-wrap gap-3">
          <input
            type="text"
            name="name"
            required
            placeholder="2568"
            maxLength={8}
            className="input w-32"
          />
          <label className="flex items-center gap-2 text-sm text-black/70">
            <input type="checkbox" name="isActive" className="h-4 w-4" />
            ใช้งานเป็นปีปัจจุบัน
          </label>
          <SubmitBtn label="เพิ่ม" />
          {state.fieldErrors?.name && (
            <p className="basis-full text-xs text-red-700">
              {state.fieldErrors.name}
            </p>
          )}
          {state.error && (
            <p className="basis-full text-xs text-red-700">
              {translateError(state.error)}
            </p>
          )}
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-medium text-black/80">
          ปีการศึกษาทั้งหมด ({years.length})
        </h2>
        {years.length === 0 ? (
          <EmptyState label="ยังไม่มีปีการศึกษา" />
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {years.map((y) => (
              <li
                key={y.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-black">
                    ปี {y.name}
                    {y.isActive && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-700">
                        ปีปัจจุบัน
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-black/50">
                    {y._count.terms} ภาคเรียน · {y._count.classes} ห้องเรียน
                  </p>
                </div>
                <form action={delAction}>
                  <input type="hidden" name="id" value={y.id} />
                  <button
                    type="submit"
                    className="rounded-lg p-2 text-black/40 hover:bg-red-50 hover:text-red-700"
                    title="ลบปีการศึกษานี้"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {delState.error && (
          <p className="mt-3 text-xs text-red-700">
            {translateError(delState.error)}
          </p>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Terms tab
// ─────────────────────────────────────────────────────────────

function TermsTab({
  years,
  terms,
}: {
  years: SetupData["years"];
  terms: SetupData["terms"];
}) {
  const [state, action] = useActionState(createTermAction, INITIAL_TERM);
  const [delState, delAction] = useActionState(
    deleteTermAction,
    INITIAL_DEL_TERM
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-medium text-black/80">
          เพิ่มภาคเรียน
        </h2>
        {years.length === 0 ? (
          <p className="text-xs text-orange-700">
            ต้องเพิ่มปีการศึกษาก่อน — ไปที่แท็บ &ldquo;ปีการศึกษา&rdquo;
          </p>
        ) : (
          <form
            ref={formRef}
            action={action}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div>
              <label className="text-xs text-black/60">ปีการศึกษา</label>
              <select
                name="academicYearId"
                required
                defaultValue={years[0]?.id ?? ""}
                className="input"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    ปี {y.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-black/60">ภาคเรียนที่</label>
              <select name="number" required defaultValue="1" className="input">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3 (ฤดูร้อน)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-black/60">วันเริ่มต้น</label>
              <input type="date" name="startDate" required className="input" />
            </div>
            <div>
              <label className="text-xs text-black/60">วันสิ้นสุด</label>
              <input type="date" name="endDate" required className="input" />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-black/70">
              <input type="checkbox" name="isActive" className="h-4 w-4" />
              ใช้งานเป็นภาคเรียนปัจจุบัน
            </label>
            <div className="col-span-2">
              <SubmitBtn label="เพิ่มภาคเรียน" />
            </div>
            {state.fieldErrors?.endDate && (
              <p className="col-span-2 text-xs text-red-700">
                {state.fieldErrors.endDate}
              </p>
            )}
            {state.fieldErrors?.number && (
              <p className="col-span-2 text-xs text-red-700">
                {state.fieldErrors.number}
              </p>
            )}
            {state.error && (
              <p className="col-span-2 text-xs text-red-700">
                {translateError(state.error)}
              </p>
            )}
          </form>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-medium text-black/80">
          ภาคเรียนทั้งหมด ({terms.length})
        </h2>
        {terms.length === 0 ? (
          <EmptyState label="ยังไม่มีภาคเรียน" />
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {terms.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-black">
                    {t.name}
                    {t.isActive && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-700">
                        ภาคเรียนปัจจุบัน
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-black/50">
                    {fmtDate(t.startDate)} – {fmtDate(t.endDate)} ·{" "}
                    {t._count.courses} วิชา
                  </p>
                </div>
                <form action={delAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    className="rounded-lg p-2 text-black/40 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {delState.error && (
          <p className="mt-3 text-xs text-red-700">
            {translateError(delState.error)}
          </p>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Classes tab
// ─────────────────────────────────────────────────────────────

function ClassesTab({
  years,
  classes,
  teachers,
}: {
  years: SetupData["years"];
  classes: SetupData["classes"];
  teachers: SetupData["teachers"];
}) {
  const [state, action] = useActionState(createClassAction, INITIAL_CLASS);
  const [delState, delAction] = useActionState(
    deleteClassAction,
    INITIAL_DEL_CLASS
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const freeTeachers = teachers.filter((t) => t.homeroomOf === null);

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-medium text-black/80">
          เพิ่มห้องเรียน
        </h2>
        {years.length === 0 ? (
          <p className="text-xs text-orange-700">ต้องเพิ่มปีการศึกษาก่อน</p>
        ) : (
          <form
            ref={formRef}
            action={action}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div>
              <label className="text-xs text-black/60">ปีการศึกษา</label>
              <select
                name="academicYearId"
                required
                defaultValue={years[0]?.id ?? ""}
                className="input"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    ปี {y.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-black/60">ชื่อห้อง</label>
              <input
                type="text"
                name="name"
                required
                placeholder="ม.4/2"
                className="input"
              />
            </div>
            <div>
              <label className="text-xs text-black/60">ชั้นปี</label>
              <input
                type="text"
                name="gradeLevel"
                required
                placeholder="ม.4"
                className="input"
              />
            </div>
            <div>
              <label className="text-xs text-black/60">
                ครูประจำชั้น (ไม่บังคับ)
              </label>
              <select name="homeroomTeacherId" className="input">
                <option value="">— ไม่กำหนด —</option>
                {freeTeachers.map((t) => (
                  <option key={t.userId} value={t.userId}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <SubmitBtn label="เพิ่มห้องเรียน" />
            </div>
            {state.fieldErrors?.name && (
              <p className="col-span-2 text-xs text-red-700">
                {state.fieldErrors.name}
              </p>
            )}
            {state.error && (
              <p className="col-span-2 text-xs text-red-700">
                {translateError(state.error)}
              </p>
            )}
          </form>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-medium text-black/80">
          ห้องเรียนทั้งหมด ({classes.length})
        </h2>
        {classes.length === 0 ? (
          <EmptyState label="ยังไม่มีห้องเรียน" />
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {classes.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-black">
                    {c.name}{" "}
                    <span className="text-black/40">
                      · ปี {c.academicYear.name}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-black/50">
                    {c.homeroomTeacher
                      ? `ครูประจำชั้น: ${c.homeroomTeacher.firstName} ${c.homeroomTeacher.lastName}`
                      : "ยังไม่มีครูประจำชั้น"}{" "}
                    · {c._count.students} นักเรียน · {c._count.courses} วิชา
                  </p>
                </div>
                <form action={delAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    className="rounded-lg p-2 text-black/40 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {delState.error && (
          <p className="mt-3 text-xs text-red-700">
            {translateError(delState.error)}
          </p>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Teachers tab (single-add)
// ─────────────────────────────────────────────────────────────

function TeachersTab({ teachers }: { teachers: SetupData["teachers"] }) {
  const [state, action] = useActionState(
    createSingleTeacherAction,
    INITIAL_TEACHER
  );
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && !state.tempPassword) formRef.current?.reset();
  }, [state.ok, state.tempPassword]);

  function copy() {
    if (!state.tempPassword) return;
    navigator.clipboard.writeText(state.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-medium text-black/80">
          เพิ่มครู (รายคน)
        </h2>
        <p className="mb-3 text-xs text-black/50">
          สำหรับครูที่เข้ามาช่วงระหว่างเทอม (ถ้านำเข้าหลายคนพร้อมกันใช้แท็บ
          &ldquo;นำเข้า CSV&rdquo;)
        </p>
        <form
          ref={formRef}
          action={action}
          className="grid gap-3 sm:grid-cols-2"
        >
          <div>
            <label className="text-xs text-black/60">อีเมล</label>
            <input
              type="email"
              name="email"
              required
              placeholder="teacher@school.ac.th"
              className="input"
            />
            {state.fieldErrors?.email && (
              <p className="mt-1 text-xs text-red-700">
                {state.fieldErrors.email}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-black/60">ชื่อ</label>
              <input type="text" name="firstName" required className="input" />
            </div>
            <div>
              <label className="text-xs text-black/60">นามสกุล</label>
              <input type="text" name="lastName" required className="input" />
            </div>
          </div>
          <div className="col-span-2">
            <SubmitBtn label="เพิ่มครู" />
          </div>
          {state.error && (
            <p className="col-span-2 text-xs text-red-700">
              {translateError(state.error)}
            </p>
          )}
        </form>

        {state.ok && state.tempPassword && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              เพิ่มครู {state.displayName} สำเร็จ
            </div>
            <p className="text-xs text-green-700/80">
              รหัสผ่านชั่วคราว (แสดงครั้งเดียว — รีเฟรชแล้วจะหาย):
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-white px-3 py-2 font-mono text-sm tracking-wider">
                {state.tempPassword}
              </code>
              <button
                type="button"
                onClick={copy}
                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
              >
                {copied ? (
                  "คัดลอกแล้ว"
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Copy className="h-3 w-3" /> คัดลอก
                  </span>
                )}
              </button>
            </div>
            <p className="mt-2 flex items-start gap-1 text-xs text-orange-700">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              เก็บไว้แจ้งครูตอนนี้ —
              ครูจะต้องเปลี่ยนรหัสผ่านในการเข้าระบบครั้งแรก
            </p>
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-medium text-black/80">
          ครูในระบบ ({teachers.length})
        </h2>
        {teachers.length === 0 ? (
          <EmptyState label="ยังไม่มีครูในระบบ" />
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {teachers.map((t) => (
              <li key={t.userId} className="py-3">
                <p className="text-sm font-medium text-black">
                  {t.firstName} {t.lastName}
                </p>
                <p className="mt-0.5 text-xs text-black/50">
                  {t.email}
                  {t.homeroomOf && (
                    <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-700">
                      ครูประจำชั้น {t.homeroomOf.name}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Plus className="mr-1 inline h-4 w-4" />
      {pending ? "กำลังบันทึก…" : label}
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-black/[0.08] p-6 text-center text-xs text-black/40">
      <X className="mx-auto mb-2 h-5 w-5" />
      {label}
    </div>
  );
}

function translateError(code: string): string {
  switch (code) {
    case "academic_year_name_exists":
      return "ปีการศึกษานี้มีอยู่แล้ว";
    case "academic_year_has_terms":
      return "ลบไม่ได้ — มีภาคเรียนอยู่ในปีนี้";
    case "academic_year_has_classes":
      return "ลบไม่ได้ — มีห้องเรียนอยู่ในปีนี้";
    case "academic_year_not_found":
      return "ไม่พบปีการศึกษา";
    case "term_number_exists_in_year":
      return "ภาคเรียนนี้มีในปีนี้แล้ว";
    case "term_has_courses":
      return "ลบไม่ได้ — มีวิชาในภาคเรียนนี้";
    case "term_not_found":
      return "ไม่พบภาคเรียน";
    case "class_name_exists_in_year":
      return "ชื่อห้องนี้มีในปีนี้แล้ว";
    case "class_has_courses":
      return "ลบไม่ได้ — มีวิชาในห้องนี้";
    case "class_has_enrollments":
      return "ลบไม่ได้ — มีนักเรียนในห้องนี้";
    case "class_not_found":
      return "ไม่พบห้องเรียน";
    case "teacher_not_found":
      return "ไม่พบครู";
    case "teacher_already_homeroom":
      return "ครูเป็นครูประจำชั้นของห้องอื่นอยู่แล้ว";
    case "email_exists":
      return "อีเมลนี้มีอยู่ในระบบแล้ว";
    case "not_admin":
      return "เฉพาะ Admin เท่านั้น";
    default:
      return code;
  }
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(d));
}
