"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, Power, Clock, X } from "lucide-react";
import {
  regenerateClassCodeAction,
  toggleClassCodeActiveAction,
  setClassCodeExpiryAction,
  type ClassCodeActionState,
} from "@/app/teacher/courses/[id]/settings/actions";

const INITIAL: ClassCodeActionState = {};

const dateFmt = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Convert a Date to the `datetime-local` input format (local TZ). */
function toLocalInputValue(d: Date | null): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Props = {
  courseId: string;
  classCode: string;
  codeActive: boolean;
  codeExpiresAt: Date | null;
};

export function ClassCodeControls({
  courseId,
  classCode,
  codeActive,
  codeExpiresAt,
}: Props) {
  return (
    <div className="space-y-6">
      <CurrentCodeSection
        courseId={courseId}
        classCode={classCode}
        codeActive={codeActive}
      />
      <ActiveToggleSection courseId={courseId} codeActive={codeActive} />
      <ExpirySection courseId={courseId} codeExpiresAt={codeExpiresAt} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Section 1 — Current code + regenerate (with confirm dialog)
// ──────────────────────────────────────────────────────────────────

function CurrentCodeSection({
  courseId,
  classCode,
  codeActive,
}: {
  courseId: string;
  classCode: string;
  codeActive: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boundAction = regenerateClassCodeAction.bind(null, courseId);
  const [state, formAction] = useActionState(boundAction, INITIAL);

  useEffect(() => {
    if (!state.ok) return;
    // Under Next 16 + React 19 + Turbopack, calling close() synchronously
    // inside the same commit cycle as the Server Action result sometimes
    // doesn't take. Defer one tick + also remove the [open] attribute
    // as belt-and-braces.
    setTimeout(() => {
      const d = dialogRef.current;
      if (!d) return;
      d.close();
      d.removeAttribute("open");
    }, 0);
  }, [state.ok]);

  return (
    <div className="card p-5">
      <header className="mb-4 flex items-start gap-3">
        <KeyRound className="mt-0.5 h-4 w-4 text-black/60" />
        <div>
          <h2
            className="font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            รหัสห้องเรียน
          </h2>
          <p className="mt-0.5 text-xs text-black/60">
            สร้างใหม่ถ้ารหัสรั่ว — รหัสเดิมจะใช้ไม่ได้ทันที
          </p>
        </div>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <code className="flex-1 rounded-xl bg-black/[0.04] px-3 py-2 font-mono text-lg font-medium tracking-wider text-black">
          {classCode}
        </code>
        {!codeActive && (
          <span className="rounded-full bg-black/[0.05] px-3 py-1 text-xs text-black/60">
            ปิดอยู่
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="btn-secondary btn-sm"
      >
        สร้างรหัสใหม่
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 shadow-lift backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <form action={formAction} className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2
              className="text-lg font-medium text-black"
              style={{ letterSpacing: "-0.02em" }}
            >
              ยืนยันการสร้างรหัสใหม่
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="ปิด"
              className="rounded-full p-1 text-black/40 transition-colors hover:bg-black/[0.05] hover:text-black"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-black/70">
            รหัส <code className="font-mono">{classCode}</code> จะใช้ไม่ได้อีก
            นักเรียนที่กำลังจะ join ด้วยรหัสนี้ต้องใช้รหัสใหม่
          </p>
          <p className="mt-2 text-sm text-black/70">
            สมาชิกที่อยู่ในห้องแล้วจะไม่ได้รับผลกระทบ
          </p>

          {state.error && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {state.error}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="btn-secondary btn-sm"
            >
              ยกเลิก
            </button>
            <SubmitButton label="สร้างรหัสใหม่" pendingLabel="กำลังสร้าง…" />
          </div>
        </form>
      </dialog>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Section 2 — Active toggle (no confirm — reversible)
// ──────────────────────────────────────────────────────────────────

function ActiveToggleSection({
  courseId,
  codeActive,
}: {
  courseId: string;
  codeActive: boolean;
}) {
  const boundAction = toggleClassCodeActiveAction.bind(null, courseId);
  const [state, formAction] = useActionState(boundAction, INITIAL);

  return (
    <div className="card p-5">
      <header className="mb-4 flex items-start gap-3">
        <Power className="mt-0.5 h-4 w-4 text-black/60" />
        <div>
          <h2
            className="font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            สถานะรหัส
          </h2>
          <p className="mt-0.5 text-xs text-black/60">
            {codeActive
              ? "รหัสเปิดอยู่ — นักเรียนใหม่ใช้ join ได้ + นักเรียนที่ถูกนำออกกลับเข้าได้ด้วย"
              : "รหัสปิดอยู่ — block การ join ทุกแบบ รวมถึงนักเรียนที่ถูกนำออกแล้วใช้กลับเข้าห้อง (ADR-0013 § 2)"}
          </p>
        </div>
      </header>

      <form action={formAction}>
        <input
          type="hidden"
          name="active"
          value={codeActive ? "false" : "true"}
        />
        {state.error && (
          <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {state.error}
          </p>
        )}
        <SubmitButton
          label={codeActive ? "ปิดรหัส" : "เปิดรหัสอีกครั้ง"}
          pendingLabel={codeActive ? "กำลังปิด…" : "กำลังเปิด…"}
          variant={codeActive ? "danger" : "primary"}
        />
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Section 3 — Expiry datetime
// ──────────────────────────────────────────────────────────────────

function ExpirySection({
  courseId,
  codeExpiresAt,
}: {
  courseId: string;
  codeExpiresAt: Date | null;
}) {
  const boundAction = setClassCodeExpiryAction.bind(null, courseId);
  const [state, formAction] = useActionState(boundAction, INITIAL);
  const [value, setValue] = useState(toLocalInputValue(codeExpiresAt));

  // If the server updates the expiry (e.g. after submit), reflect it in the input.
  // We use the prop as source-of-truth on mount + on prop changes (via key).
  return (
    <div className="card p-5">
      <header className="mb-4 flex items-start gap-3">
        <Clock className="mt-0.5 h-4 w-4 text-black/60" />
        <div>
          <h2
            className="font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            วันหมดอายุ
          </h2>
          <p className="mt-0.5 text-xs text-black/60">
            {codeExpiresAt
              ? `รหัสจะหมดอายุ ${dateFmt.format(codeExpiresAt)}`
              : "ใช้งานได้ตลอด — ปล่อยว่างถ้าไม่ต้องการตั้งวัน"}
          </p>
        </div>
      </header>

      <form action={formAction} className="space-y-3">
        <input
          type="datetime-local"
          name="expiresAt"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input"
          aria-invalid={state.fieldErrors?.expiresAt ? true : undefined}
        />
        {state.fieldErrors?.expiresAt && (
          <p className="text-xs text-rose-600">{state.fieldErrors.expiresAt}</p>
        )}
        {state.error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {state.error}
          </p>
        )}
        <div className="flex items-center gap-2">
          <SubmitButton label="บันทึก" pendingLabel="กำลังบันทึก…" />
          {codeExpiresAt && (
            <button
              type="submit"
              onClick={() => setValue("")}
              className="btn-ghost btn-sm"
            >
              ลบวันหมดอายุ
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────

function SubmitButton({
  label,
  pendingLabel,
  variant = "primary",
}: {
  label: string;
  pendingLabel: string;
  variant?: "primary" | "danger";
}) {
  const { pending } = useFormStatus();
  const cls =
    variant === "danger"
      ? "btn-danger btn-sm"
      : variant === "primary"
        ? "btn-primary btn-sm"
        : "btn-secondary btn-sm";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${cls} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
