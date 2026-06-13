"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteAssignmentAction,
  updateAssignmentAction,
  type AssignmentMutationState,
} from "@/app/teacher/courses/[id]/assignments/actions";

interface AssignmentRowActionsProps {
  courseId: string;
  assignment: {
    id: string;
    title: string;
    description: string;
    dueAt: Date | null;
    allowText: boolean;
    allowFile: boolean;
    allowLink: boolean;
    submissionClosed: boolean;
    autoCloseAtDue: boolean;
    isScored: boolean;
    scoreItem: { publishedAt: Date | null } | null;
  };
}

const INITIAL: AssignmentMutationState = {};

export function AssignmentRowActions({
  courseId,
  assignment,
}: AssignmentRowActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-2">
      <EditAssignmentDialog courseId={courseId} assignment={assignment} />
      <DeleteAssignmentDialog courseId={courseId} assignment={assignment} />
    </div>
  );
}

function EditAssignmentDialog({
  courseId,
  assignment,
}: AssignmentRowActionsProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, formAction, isPending] = useActionState<
    AssignmentMutationState,
    FormData
  >(updateAssignmentAction, INITIAL);
  const [isScored, setIsScored] = useState(assignment.isScored);

  useEffect(() => {
    if (!state.ok) return;
    setTimeout(() => {
      const dialog = dialogRef.current;
      dialog?.close();
      dialog?.removeAttribute("open");
    }, 0);
  }, [state.ok]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-lg p-2 text-black/40 hover:bg-blue-50 hover:text-blue-700"
        title="แก้ไขการบ้าน"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <input
            type="hidden"
            name="wasScored"
            value={assignment.isScored ? "true" : "false"}
          />

          <h3 className="text-lg font-medium text-black">แก้ไขการบ้าน</h3>
          <p className="mt-0.5 text-xs text-black/50">
            ปรับโจทย์ ช่องทางส่ง กำหนดส่ง และสถานะการรับงาน
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-black/70">
                ชื่อการบ้าน <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                maxLength={200}
                defaultValue={assignment.title}
                className="input mt-1"
              />
              {state.fieldErrors?.title && (
                <p className="mt-1 text-xs text-red-700">
                  {state.fieldErrors.title}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-black/70">
                คำอธิบาย / โจทย์
              </label>
              <textarea
                name="description"
                rows={4}
                maxLength={10_000}
                defaultValue={assignment.description}
                className="input mt-1"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-black/70">
                กำหนดส่ง
              </label>
              <input
                type="datetime-local"
                name="dueAt"
                defaultValue={
                  assignment.dueAt ? dateTimeInputValue(assignment.dueAt) : ""
                }
                className="input mt-1"
              />
            </div>

            <fieldset className="rounded-lg border border-black/10 p-3">
              <legend className="px-1 text-xs font-medium text-black/70">
                ช่องทางส่ง
              </legend>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allowText"
                    defaultChecked={assignment.allowText}
                    className="h-4 w-4"
                  />
                  ข้อความ
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allowFile"
                    defaultChecked={assignment.allowFile}
                    className="h-4 w-4"
                  />
                  ไฟล์
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="allowLink"
                    defaultChecked={assignment.allowLink}
                    className="h-4 w-4"
                  />
                  ลิงก์
                </label>
              </div>
              {state.fieldErrors?.allowText && (
                <p className="mt-2 text-xs text-red-700">
                  {state.fieldErrors.allowText}
                </p>
              )}
            </fieldset>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="autoCloseAtDue"
                defaultChecked={assignment.autoCloseAtDue}
                className="h-4 w-4"
              />
              ปิดการส่งอัตโนมัติเมื่อถึงกำหนดส่ง
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="submissionClosed"
                defaultChecked={assignment.submissionClosed}
                className="h-4 w-4"
              />
              ปิดรับงานตอนนี้
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isScored"
                checked={isScored}
                onChange={(event) => setIsScored(event.target.checked)}
                disabled={assignment.scoreItem?.publishedAt !== null}
                className="h-4 w-4"
              />
              <span className="font-medium">นับคะแนน</span>
              {assignment.scoreItem?.publishedAt !== null && (
                <span className="text-xs text-black/45">
                  ล็อกแล้ว เพราะรายการคะแนนเผยแพร่แล้ว
                </span>
              )}
            </label>

            {!assignment.isScored && isScored && (
              <div className="rounded-lg bg-orange-50/50 p-3">
                <label className="block text-xs font-medium text-black/70">
                  คะแนนเต็ม <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="fullScore"
                  min={1}
                  step={1}
                  className="input mt-1"
                  placeholder="10"
                />
                {state.fieldErrors?.fullScore && (
                  <p className="mt-1 text-xs text-red-700">
                    {state.fieldErrors.fullScore}
                  </p>
                )}
              </div>
            )}
          </div>

          {state.error && (
            <p className="mt-3 text-xs text-red-700">
              {translateMutationError(state.error)}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => dialogRef.current?.close()}
              disabled={isPending}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn-primary btn-sm"
              disabled={isPending}
            >
              {isPending ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function DeleteAssignmentDialog({
  courseId,
  assignment,
}: AssignmentRowActionsProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [state, formAction, isPending] = useActionState<
    AssignmentMutationState,
    FormData
  >(deleteAssignmentAction, INITIAL);

  useEffect(() => {
    if (!state.ok) return;
    setTimeout(() => {
      const dialog = dialogRef.current;
      dialog?.close();
      dialog?.removeAttribute("open");
    }, 0);
  }, [state.ok]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-lg p-2 text-black/40 hover:bg-red-50 hover:text-red-700"
        title="ลบการบ้าน"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <dialog
        ref={dialogRef}
        className="fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-md rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/40"
      >
        <form action={formAction} className="p-6">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="assignmentId" value={assignment.id} />

          <h3 className="text-lg font-medium text-black">ลบการบ้านนี้?</h3>
          <p className="mt-2 text-sm text-black/60">{assignment.title}</p>
          <p className="mt-2 text-xs text-black/45">
            ถ้าการบ้านผูกกับคะแนนที่เผยแพร่แล้ว หรือมีคะแนนที่ถูกกรอกแล้ว
            ระบบจะไม่อนุญาตให้ลบเพื่อป้องกันข้อมูลหาย
          </p>

          {state.error && (
            <p className="mt-3 text-xs text-red-700">
              {translateMutationError(state.error)}
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => dialogRef.current?.close()}
              disabled={isPending}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              disabled={isPending}
            >
              {isPending ? "กำลังลบ…" : "ลบการบ้าน"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function dateTimeInputValue(value: Date): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function translateMutationError(code: string): string {
  switch (code) {
    case "linked_scoreitem_published":
      return "รายการคะแนนของการบ้านนี้เผยแพร่แล้ว จึงแก้/ลบส่วนคะแนนไม่ได้";
    case "assignment_has_scored_entries":
      return "มีคะแนนที่ถูกกรอกแล้ว จึงลบหรือถอดการนับคะแนนไม่ได้";
    case "assignment_not_found":
      return "ไม่พบการบ้านนี้";
    case "not_course_owner":
      return "แก้ไขได้เฉพาะครูเจ้าของวิชา";
    default:
      return code;
  }
}
