"use client";

import { useActionState } from "react";
import { createCourseAction, type CreateCourseState } from "./actions";

interface FormProps {
  subjects: {
    id: string;
    name: string;
    gradeLevel: string;
    creditHours: number;
  }[];
  classes: { id: string; name: string; gradeLevel: string }[];
  terms: { id: string; name: string; number: number; isActive: boolean }[];
}

const initial: CreateCourseState = {};

export function CreateCourseForm({ subjects, classes, terms }: FormProps) {
  const [state, action, pending] = useActionState(createCourseAction, initial);

  // Default to active term if any
  const defaultTerm = terms.find((t) => t.isActive)?.id ?? terms[0]?.id ?? "";

  return (
    <form action={action} className="space-y-5">
      <div className="card p-5">
        <label htmlFor="subjectId" className="mb-1.5 block text-sm font-medium">
          รายวิชา
        </label>
        <select
          id="subjectId"
          name="subjectId"
          required
          defaultValue=""
          className="input"
        >
          <option value="" disabled>
            -- เลือกวิชา --
          </option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.creditHours} หน่วยกิต)
            </option>
          ))}
        </select>
        {state.fieldErrors?.subjectId && (
          <p className="mt-1 text-xs text-rose-600">
            {state.fieldErrors.subjectId}
          </p>
        )}
      </div>

      <div className="card p-5">
        <label htmlFor="classId" className="mb-1.5 block text-sm font-medium">
          ห้องเรียน
        </label>
        <select
          id="classId"
          name="classId"
          required
          defaultValue=""
          className="input"
        >
          <option value="" disabled>
            -- เลือกห้อง --
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {state.fieldErrors?.classId && (
          <p className="mt-1 text-xs text-rose-600">
            {state.fieldErrors.classId}
          </p>
        )}
      </div>

      <div className="card p-5">
        <label htmlFor="termId" className="mb-1.5 block text-sm font-medium">
          ภาคเรียน
        </label>
        <select
          id="termId"
          name="termId"
          required
          defaultValue={defaultTerm}
          className="input"
        >
          <option value="" disabled>
            -- เลือกเทอม --
          </option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.isActive ? "(ปัจจุบัน)" : ""}
            </option>
          ))}
        </select>
        {state.fieldErrors?.termId && (
          <p className="mt-1 text-xs text-rose-600">
            {state.fieldErrors.termId}
          </p>
        )}
      </div>

      {state.error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary flex-1 justify-center"
        >
          {pending ? "กำลังสร้าง..." : "สร้างวิชา & รับรหัสห้อง"}
        </button>
      </div>
    </form>
  );
}
