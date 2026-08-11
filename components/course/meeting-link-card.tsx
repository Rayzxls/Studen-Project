"use client";

import { useActionState } from "react";
import { CheckCircle2, Video } from "lucide-react";

import {
  setMeetingUrlAction,
  type MeetingUrlActionState,
} from "@/app/teacher/courses/[id]/settings/actions";

const INITIAL: MeetingUrlActionState = {};

/**
 * The course's standing online room (ADR-0052).
 *
 * One link for the term, because a teacher's Meet room is the same room every
 * week exactly as a physical classroom is. A period that meets somewhere else
 * overrides it from the timetable editor below.
 */
export function MeetingLinkCard({
  courseId,
  meetingUrl,
}: {
  courseId: string;
  meetingUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    setMeetingUrlAction,
    INITIAL
  );

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
          <Video className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">ห้องเรียนออนไลน์</h2>
          <p className="mt-0.5 text-sm leading-6 text-ink-mute">
            วางลิงก์ห้องประชุมที่ใช้สอนวิชานี้
            นักเรียนในวิชาจะเห็นลิงก์นี้ในตารางเรียน
            ระบบไม่ได้สร้างห้องประชุมเอง — ใช้ Google Meet, Zoom
            หรือบริการที่โรงเรียนใช้อยู่
          </p>
        </div>
      </div>

      <form action={formAction} className="mt-4">
        <input type="hidden" name="courseId" value={courseId} />
        <label htmlFor="course-meeting-url" className="label">
          ลิงก์ประจำวิชา{" "}
          <span className="font-normal text-ink-faint">(ไม่บังคับ)</span>
        </label>
        <input
          id="course-meeting-url"
          name="meetingUrl"
          type="url"
          className="input mt-1.5"
          maxLength={500}
          defaultValue={meetingUrl ?? ""}
          placeholder="https://meet.google.com/..."
          aria-invalid={state.fieldErrors?.meetingUrl ? true : undefined}
          aria-describedby="course-meeting-url-help"
        />
        <p id="course-meeting-url-help" className="mt-1 text-xs text-ink-mute">
          เว้นว่างแล้วบันทึกเพื่อลบลิงก์ · เห็นได้เฉพาะนักเรียนในวิชานี้
        </p>

        {state.fieldErrors?.meetingUrl && (
          <p className="mt-2 text-xs text-red-700">
            {state.fieldErrors.meetingUrl}
          </p>
        )}
        {state.error && (
          <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {state.error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="btn-primary btn-sm"
            disabled={pending}
          >
            {pending ? "กำลังบันทึก…" : "บันทึกลิงก์"}
          </button>
          {state.ok && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              บันทึกแล้ว
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
