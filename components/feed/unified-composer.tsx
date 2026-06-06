"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ClipboardList,
  FileText,
  Link2,
  Megaphone,
  Paperclip,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  composeAnnouncementAction,
  composeAssignmentAction,
  composeMaterialAction,
  type ComposeAnnouncementState,
  type ComposeAssignmentState,
  type ComposeMaterialState,
} from "@/app/teacher/courses/[id]/feed/actions";

/**
 * Unified Course Feed composer — Phase 10C · ADR-0025 § 3 (redesigned).
 *
 * A single Pattern-7 dialog with an iOS-style segmented control at the top
 * (matching the course TabNav vocabulary — tinted track + white active pill
 * with shadow-lift); the form body swaps based on the selected type. Each
 * form posts to its own Server Action — the segment choice just routes.
 *
 * URL/link attachment is live for ประกาศ + เอกสาร (the create lib already
 * persists `linkUrls`). Teacher file/image attachment + assignment links are
 * the deferred ADR-0021 pipeline — surfaced here as a disabled
 * "แนบไฟล์ · เร็วๆ นี้" affordance so the layout anticipates it.
 */

type ChipKey = "announcement" | "assignment" | "material";

const CHIPS: {
  key: ChipKey;
  label: string;
  icon: LucideIcon;
  hint: string;
}[] = [
  {
    key: "announcement",
    label: "ประกาศ",
    icon: Megaphone,
    hint: "แจ้งข่าวให้ทั้งห้องเห็นในฟีด",
  },
  {
    key: "assignment",
    label: "การบ้าน",
    icon: ClipboardList,
    hint: "มอบหมายงาน นักเรียนส่งไฟล์ / ลิงก์ / ข้อความได้",
  },
  {
    key: "material",
    label: "เอกสาร",
    icon: FileText,
    hint: "แชร์สื่อการสอนและลิงก์ประกอบ",
  },
];

const INITIAL_ANN: ComposeAnnouncementState = {};
const INITIAL_ASN: ComposeAssignmentState = {};
const INITIAL_MAT: ComposeMaterialState = {};

export function UnifiedComposer({ courseId }: { courseId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [chip, setChip] = useState<ChipKey>("announcement");

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  const active = CHIPS.find((c) => c.key === chip)!;

  return (
    <>
      <button type="button" onClick={open} className="btn-primary btn-sm">
        <Plus className="mr-1 inline h-4 w-4" />
        สร้างใหม่
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="composer-title"
        className="fixed inset-0 m-auto h-fit max-h-[88vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-3xl bg-white p-0 shadow-lift backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="flex max-h-[88vh] flex-col">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <div>
              <h2
                id="composer-title"
                className="text-lg font-semibold text-black"
                style={{ letterSpacing: "-0.02em" }}
              >
                สร้างใหม่
              </h2>
              <p className="mt-0.5 text-xs text-black/50">{active.hint}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="ปิด"
              className="-mr-1 -mt-1 rounded-full p-1.5 text-black/40 transition-colors hover:bg-black/[0.05] hover:text-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Segmented type selector — iOS track + white active pill. */}
          <div className="px-6 pt-4">
            <div
              role="radiogroup"
              aria-label="ประเภทที่จะสร้าง"
              className="flex gap-1 rounded-2xl bg-black/[0.04] p-1"
            >
              {CHIPS.map(({ key, label, icon: Icon }) => {
                const selected = chip === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setChip(key)}
                    className={
                      "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium " +
                      (selected
                        ? "bg-white text-black shadow-lift"
                        : "text-black/55 hover:text-black")
                    }
                    style={{
                      transition:
                        "background-color var(--duration-spring-standard) var(--ease-spring), box-shadow var(--duration-spring-standard) var(--ease-spring), color var(--duration-spring-standard) var(--ease-spring)",
                    }}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
            {chip === "announcement" && (
              <AnnouncementForm courseId={courseId} close={close} />
            )}
            {chip === "assignment" && (
              <AssignmentForm courseId={courseId} close={close} />
            )}
            {chip === "material" && (
              <MaterialForm courseId={courseId} close={close} />
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Announcement form
// ─────────────────────────────────────────────────────────────

function AnnouncementForm({
  courseId,
  close,
}: {
  courseId: string;
  close: () => void;
}) {
  const [state, action] = useActionState(
    composeAnnouncementAction,
    INITIAL_ANN
  );
  const formRef = useRef<HTMLFormElement>(null);
  useDeferredClose(state.ok, close, formRef);
  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="หัวข้อ" hint="ไม่บังคับ" htmlFor="ann-title">
        <input
          id="ann-title"
          type="text"
          name="title"
          maxLength={200}
          className="input"
          placeholder="เช่น งดสอบวันศุกร์"
        />
      </Field>
      <Field label="เนื้อหา" error={state.fieldErrors?.body} htmlFor="ann-body">
        <textarea
          id="ann-body"
          name="body"
          required
          rows={4}
          className="input"
          placeholder="พิมพ์ข้อความที่ต้องการประกาศ…"
        />
      </Field>
      <LinksField error={state.fieldErrors?.linkUrls} idPrefix="ann" />
      <AttachSoon />
      {state.error && <FormError error={state.error} />}
      <Actions close={close} label="โพสต์ประกาศ" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Assignment form
// ─────────────────────────────────────────────────────────────

function AssignmentForm({
  courseId,
  close,
}: {
  courseId: string;
  close: () => void;
}) {
  const [state, action] = useActionState(composeAssignmentAction, INITIAL_ASN);
  const [isScored, setIsScored] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useDeferredClose(state.ok, close, formRef);
  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <Field
        label="ชื่อการบ้าน"
        error={state.fieldErrors?.title}
        htmlFor="asn-title"
      >
        <input
          id="asn-title"
          type="text"
          name="title"
          required
          maxLength={200}
          className="input"
          placeholder="เช่น แบบฝึกหัดบทที่ 3"
        />
      </Field>
      <Field label="คำอธิบาย" hint="ไม่บังคับ" htmlFor="asn-desc">
        <textarea
          id="asn-desc"
          name="description"
          rows={3}
          className="input"
          placeholder="อธิบายงานที่ต้องส่ง…"
        />
      </Field>
      <Field label="กำหนดส่ง" hint="ไม่บังคับ" htmlFor="asn-due">
        <input
          id="asn-due"
          type="datetime-local"
          name="dueAt"
          className="input"
        />
      </Field>

      {/* Scored toggle — soft tinted panel when on. */}
      <div
        className={
          "rounded-xl border p-3 transition-colors " +
          (isScored
            ? "border-blue-200 bg-blue-50/50"
            : "border-black/[0.08] bg-black/[0.015]")
        }
      >
        <label className="flex items-center gap-2 text-sm text-black/80">
          <input
            type="checkbox"
            name="isScored"
            checked={isScored}
            onChange={(e) => setIsScored(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          <span className="font-medium">นับคะแนน</span>
          <span className="text-xs text-black/45">
            (สร้างรายการคะแนนผูกอัตโนมัติ)
          </span>
        </label>
        {isScored && (
          <div className="mt-3">
            <Field
              label="คะแนนเต็ม"
              error={state.fieldErrors?.fullScore}
              htmlFor="asn-full"
            >
              <input
                id="asn-full"
                type="number"
                name="fullScore"
                min={1}
                step={1}
                inputMode="numeric"
                className="input"
                placeholder="10"
              />
            </Field>
            <p className="mt-1 text-[10px] text-black/40">
              คะแนนเต็มที่สูงกว่า = อิทธิพลในเกรดวิชามากกว่าโดยอัตโนมัติ
              (ADR-0024)
            </p>
          </div>
        )}
      </div>

      <p className="flex items-center gap-1.5 rounded-lg bg-black/[0.025] px-3 py-2 text-[11px] text-black/45">
        <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        นักเรียนส่งงานได้ทั้ง ข้อความ · ไฟล์/รูป · ลิงก์ ในหน้าการบ้าน
      </p>
      <AttachSoon label="แนบไฟล์ / ลิงก์ประกอบงาน · เร็วๆ นี้" />
      {state.error && <FormError error={state.error} />}
      <Actions close={close} label="โพสต์การบ้าน" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Material form
// ─────────────────────────────────────────────────────────────

function MaterialForm({
  courseId,
  close,
}: {
  courseId: string;
  close: () => void;
}) {
  const [state, action] = useActionState(composeMaterialAction, INITIAL_MAT);
  const formRef = useRef<HTMLFormElement>(null);
  useDeferredClose(state.ok, close, formRef);
  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <Field
        label="หัวข้อ"
        error={state.fieldErrors?.title}
        htmlFor="mat-title"
      >
        <input
          id="mat-title"
          type="text"
          name="title"
          required
          maxLength={200}
          className="input"
          placeholder="เช่น สไลด์บทที่ 3"
        />
      </Field>
      <Field label="คำอธิบาย" hint="ไม่บังคับ" htmlFor="mat-body">
        <textarea
          id="mat-body"
          name="body"
          rows={4}
          className="input"
          placeholder="อธิบายเนื้อหา…"
        />
      </Field>
      <LinksField error={state.fieldErrors?.linkUrls} idPrefix="mat" />
      <AttachSoon />
      {state.error && <FormError error={state.error} />}
      <Actions close={close} label="โพสต์เอกสาร" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-xs font-medium text-black/60"
      >
        {label}
        {hint && <span className="font-normal text-black/35">· {hint}</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** Live link attachment — newline-separated URLs persisted to `linkUrls`. */
function LinksField({ error, idPrefix }: { error?: string; idPrefix: string }) {
  return (
    <div>
      <label
        htmlFor={`${idPrefix}-links`}
        className="flex items-center gap-1.5 text-xs font-medium text-black/60"
      >
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        ลิงก์แนบ
        <span className="font-normal text-black/35">
          · 1 บรรทัด = 1 ลิงก์ (สูงสุด 5)
        </span>
      </label>
      <textarea
        id={`${idPrefix}-links`}
        name="linkUrls"
        rows={2}
        className="input mt-1.5 font-mono text-xs"
        placeholder="https://example.com"
      />
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

/** Disabled placeholder for the deferred file-upload pipeline (ADR-0021). */
function AttachSoon({
  label = "แนบไฟล์ / รูป · เร็วๆ นี้",
}: {
  label?: string;
}) {
  return (
    <div
      aria-disabled="true"
      title="ฟีเจอร์แนบไฟล์กำลังจะมา"
      className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-dashed border-black/15 bg-black/[0.015] px-3 py-2.5 text-xs text-black/35"
    >
      <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </div>
  );
}

function FormError({ error }: { error: string }) {
  return (
    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
      {error}
    </p>
  );
}

function Actions({ close, label }: { close: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={close} className="btn-secondary btn-sm">
        ยกเลิก
      </button>
      <SubmitButton label={label} />
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary btn-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "กำลังโพสต์…" : label}
    </button>
  );
}

function useDeferredClose(
  ok: boolean | undefined,
  close: () => void,
  formRef: React.RefObject<HTMLFormElement | null>
) {
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => {
      formRef.current?.reset();
      close();
    }, 0);
    return () => clearTimeout(t);
  }, [ok, close, formRef]);
}
