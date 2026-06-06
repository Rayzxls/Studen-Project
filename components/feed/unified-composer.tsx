"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardList, FileText, Megaphone, Plus, X } from "lucide-react";
import {
  composeAnnouncementAction,
  composeAssignmentAction,
  composeMaterialAction,
  type ComposeAnnouncementState,
  type ComposeAssignmentState,
  type ComposeMaterialState,
} from "@/app/teacher/courses/[id]/feed/actions";

/**
 * Unified Course Feed composer — Phase 10C · ADR-0025 § 3.
 *
 * A single Pattern-7 dialog with a content-type chip selector at the
 * top; the form body swaps based on the chip. Each form posts to its
 * own Server Action under the hood — no shared validator. The chip
 * choice just routes the submit.
 *
 * Multi-image carousel attachments are deferred to a follow-up commit
 * — the chips + text+score forms ship first per the Phase 10 grill
 * priority. The composer is designed to accept an `<input
 * type="file" multiple>` slot when the upload pipeline is wired into
 * the form. For now, the public-facing feature is text + links +
 * optional fullScore (assignments), which already feels like a
 * Google-Classroom-shaped composer for the Phase 10 launch.
 */

type ChipKey = "announcement" | "assignment" | "material";

const CHIPS: { key: ChipKey; label: string; icon: React.ElementType }[] = [
  { key: "announcement", label: "ประกาศ", icon: Megaphone },
  { key: "assignment", label: "การบ้าน", icon: ClipboardList },
  { key: "material", label: "เอกสาร", icon: FileText },
];

const INITIAL_ANN: ComposeAnnouncementState = {};
const INITIAL_ASN: ComposeAssignmentState = {};
const INITIAL_MAT: ComposeMaterialState = {};

export function UnifiedComposer({ courseId }: { courseId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [chip, setChip] = useState<ChipKey>("announcement");

  const open = () => dialogRef.current?.showModal();
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" onClick={open} className="btn-primary btn-sm">
        <Plus className="mr-1 inline h-4 w-4" />
        สร้างใหม่
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-xl rounded-2xl bg-white p-0 shadow-lift backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
      >
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2
              className="text-lg font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              สร้างใหม่
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="ปิด"
              className="rounded-full p-1 text-black/40 transition-colors hover:bg-black/[0.05] hover:text-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Type chip selector */}
          <div className="mb-4 flex flex-wrap gap-1">
            {CHIPS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setChip(key)}
                className={
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors " +
                  (chip === key
                    ? "border-black bg-black text-white"
                    : "border-black/[0.08] bg-white text-black/60 hover:border-black/30 hover:text-black")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

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
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="หัวข้อ (ไม่บังคับ)">
        <input
          type="text"
          name="title"
          maxLength={200}
          className="input"
          placeholder="เช่น งดสอบวันศุกร์"
        />
      </Field>
      <Field label="เนื้อหา" error={state.fieldErrors?.body}>
        <textarea
          name="body"
          required
          rows={4}
          className="input"
          placeholder="พิมพ์ข้อความที่ต้องการประกาศ…"
        />
      </Field>
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
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="ชื่อการบ้าน" error={state.fieldErrors?.title}>
        <input
          type="text"
          name="title"
          required
          maxLength={200}
          className="input"
          placeholder="เช่น แบบฝึกหัดบทที่ 3"
        />
      </Field>
      <Field label="คำอธิบาย">
        <textarea
          name="description"
          rows={3}
          className="input"
          placeholder="อธิบายงานที่ต้องส่ง…"
        />
      </Field>
      <Field label="กำหนดส่ง (ไม่บังคับ)">
        <input type="datetime-local" name="dueAt" className="input" />
      </Field>
      <label className="flex items-center gap-2 text-sm text-black/70">
        <input
          type="checkbox"
          name="isScored"
          checked={isScored}
          onChange={(e) => setIsScored(e.target.checked)}
          className="h-4 w-4"
        />
        <span className="font-medium">นับคะแนน</span>
        <span className="text-xs text-black/40">
          (สร้างรายการคะแนนผูกอัตโนมัติ)
        </span>
      </label>
      {isScored && (
        <Field label="คะแนนเต็ม" error={state.fieldErrors?.fullScore}>
          <input
            type="number"
            name="fullScore"
            min={1}
            step={1}
            className="input"
            placeholder="10"
          />
          <p className="mt-1 text-[10px] text-black/40">
            คะแนนเต็มที่สูงกว่า = อิทธิพลในเกรดวิชามากกว่าโดยอัตโนมัติ
            (ADR-0024)
          </p>
        </Field>
      )}
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
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="courseId" value={courseId} />
      <Field label="หัวข้อ" error={state.fieldErrors?.title}>
        <input
          type="text"
          name="title"
          required
          maxLength={200}
          className="input"
          placeholder="เช่น สไลด์บทที่ 3"
        />
      </Field>
      <Field label="คำอธิบาย">
        <textarea
          name="body"
          rows={4}
          className="input"
          placeholder="อธิบายเนื้อหา / แนบลิงก์…"
        />
      </Field>
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
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-black/60">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
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
    <div className="flex justify-end gap-2 pt-2">
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
