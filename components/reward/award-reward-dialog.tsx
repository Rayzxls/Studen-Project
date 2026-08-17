"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Gift, Sparkles, X } from "lucide-react";

import {
  awardCourseRewardAction,
  type RewardActionState,
} from "@/app/teacher/courses/[id]/rewards/actions";
import type { CourseRewardCandidate } from "@/lib/reward/course-dashboard";
import { rewardAchievementLabel } from "@/lib/reward/presentation";

const INITIAL_STATE: RewardActionState = {};

export function AwardRewardDialog({
  courseId,
  enrollmentId,
  studentName,
  candidates,
}: {
  courseId: string;
  enrollmentId: string;
  studentName: string;
  candidates: CourseRewardCandidate[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const available = useMemo(
    () => candidates.filter((candidate) => !candidate.awarded),
    [candidates]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = available[selectedIndex];
  const [state, formAction] = useActionState(
    awardCourseRewardAction,
    INITIAL_STATE
  );

  const open = () => {
    setSelectedIndex(0);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  useEffect(() => {
    if (!state.ok) return;
    setTimeout(() => dialogRef.current?.close(), 0);
  }, [state.ok]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={available.length === 0}
        className="btn-primary btn-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
        title={
          available.length === 0
            ? "ยังไม่มีผลงานใหม่ที่ให้แต้มได้"
            : `ให้แต้ม ${studentName}`
        }
      >
        <Gift className="h-4 w-4" aria-hidden="true" />
        ให้แต้ม
      </button>

      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl bg-white p-0 shadow-lift backdrop:bg-black/45 backdrop:backdrop-blur-sm"
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
      >
        <form action={formAction} className="p-5 sm:p-7">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input
            type="hidden"
            name="achievementType"
            value={selected?.achievementType ?? ""}
          />
          <input
            type="hidden"
            name="achievementId"
            value={selected?.achievementId ?? ""}
          />

          <header className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-black">
                  ให้แต้ม {studentName}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-black/55">
                  เลือกผลงานจริงในวิชา แต้มเดียวกันจะจ่ายซ้ำไม่ได้
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="ปิด"
              className="cursor-pointer rounded-full p-2 text-black/40 transition-colors hover:bg-black/[0.05] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="mt-6 space-y-5">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-black/60">
                ผลงานที่ได้รับแต้ม
              </legend>
              <div className="grid max-h-56 gap-2 overflow-y-auto pr-1">
                {available.map((candidate, index) => {
                  const active = index === selectedIndex;
                  return (
                    <button
                      key={`${candidate.achievementType}:${candidate.achievementId}`}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      aria-pressed={active}
                      className={
                        "cursor-pointer rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " +
                        (active
                          ? "border-blue-400 bg-blue-50"
                          : "border-black/10 bg-white hover:bg-slate-50")
                      }
                    >
                      <span className="block text-[11px] font-semibold text-blue-700">
                        {rewardAchievementLabel(candidate.achievementType)}
                      </span>
                      <span className="mt-0.5 block text-sm font-medium text-black">
                        {candidate.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-black/50">
                        {candidate.detail}
                      </span>
                    </button>
                  );
                })}
              </div>
              {state.fieldErrors?.achievement && (
                <p className="mt-1.5 text-xs text-red-700">
                  {state.fieldErrors.achievement}
                </p>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
              <div>
                <label
                  htmlFor={`reward-points-${enrollmentId}`}
                  className="mb-1.5 block text-xs font-semibold text-black/60"
                >
                  จำนวนแต้ม
                </label>
                <input
                  id={`reward-points-${enrollmentId}`}
                  name="points"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  defaultValue={10}
                  required
                  className="input"
                />
                {state.fieldErrors?.points && (
                  <p className="mt-1 text-xs text-red-700">
                    {state.fieldErrors.points}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor={`reward-reason-${enrollmentId}`}
                  className="mb-1.5 block text-xs font-semibold text-black/60"
                >
                  เหตุผลที่นักเรียนจะเห็น
                </label>
                <input
                  id={`reward-reason-${enrollmentId}`}
                  name="reason"
                  type="text"
                  minLength={5}
                  maxLength={500}
                  required
                  placeholder="เช่น ส่งงานครบและอธิบายวิธีคิดชัดเจน"
                  className="input"
                />
                {state.fieldErrors?.reason && (
                  <p className="mt-1 text-xs text-red-700">
                    {state.fieldErrors.reason}
                  </p>
                )}
              </div>
            </div>

            {(state.error || state.fieldErrors?.reward) && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {state.error ?? state.fieldErrors?.reward}
              </p>
            )}
          </div>

          <footer className="mt-6 flex flex-wrap justify-end gap-2 border-t border-black/[0.06] pt-5">
            <button
              type="button"
              onClick={close}
              className="btn-secondary btn-sm cursor-pointer"
            >
              ยกเลิก
            </button>
            <AwardSubmitButton disabled={!selected} />
          </footer>
        </form>
      </dialog>
    </>
  );
}

function AwardSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="btn-primary btn-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "กำลังบันทึก…" : "ยืนยันให้แต้ม"}
    </button>
  );
}
