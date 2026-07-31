"use client";

import { useActionState, useState } from "react";
import { createCourseAction, type CreateCourseState } from "./actions";

const initial: CreateCourseState = {};

export function CreateCourseForm() {
  const [state, action, pending] = useActionState(createCourseAction, initial);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <form action={action} className="space-y-5">
      {/* Workspace name */}
      <div className="card p-5">
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
          ชื่อวิชา (ตั้งเอง)
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          className="input"
          placeholder="เช่น คณิตศาสตร์ ม.4 ครูสมชาย"
          defaultValue=""
        />
        <p className="mt-1.5 text-xs text-ink-soft">
          ครู ตั้งชื่อตามที่ต้องการ — นักเรียนจะเห็นชื่อนี้
        </p>
        {state.fieldErrors?.name && (
          <p className="mt-1 text-xs text-red-700">{state.fieldErrors.name}</p>
        )}
      </div>

      {/* Teacher-owned display metadata */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <label
            htmlFor="learnerGroupLabel"
            className="mb-1.5 block text-sm font-medium"
          >
            กลุ่มผู้เรียน (ไม่บังคับ)
          </label>
          <input
            id="learnerGroupLabel"
            name="learnerGroupLabel"
            type="text"
            maxLength={80}
            className="input"
            placeholder="เช่น ม.4/3 หรือ นักศึกษาปี 1"
          />
          {state.fieldErrors?.learnerGroupLabel && (
            <p className="mt-1 text-xs text-red-700">
              {state.fieldErrors.learnerGroupLabel}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-soft">
            ใช้เพื่อแสดงผลเท่านั้น วิชาที่เขียนเหมือนกันจะไม่ถูกรวมเข้าด้วยกัน
          </p>
        </div>

        <div className="card p-5">
          <label
            htmlFor="academicPeriodLabel"
            className="mb-1.5 block text-sm font-medium"
          >
            ช่วงการศึกษา (ไม่บังคับ)
          </label>
          <input
            id="academicPeriodLabel"
            name="academicPeriodLabel"
            type="text"
            maxLength={80}
            className="input"
            placeholder="เช่น ภาคเรียน 1 ปี 2569"
          />
          {state.fieldErrors?.academicPeriodLabel && (
            <p className="mt-1 text-xs text-red-700">
              {state.fieldErrors.academicPeriodLabel}
            </p>
          )}
        </div>
      </div>

      {/* Credit */}
      <div className="card p-5">
        <label
          htmlFor="creditHours"
          className="mb-1.5 block text-sm font-medium"
        >
          หน่วยกิต
        </label>
        <input
          id="creditHours"
          name="creditHours"
          type="number"
          step="0.5"
          min="0"
          max="10"
          className="input"
        />
        <p className="mt-1.5 text-xs text-ink-soft">
          ไม่บังคับ ใช้เป็นข้อมูลประกอบในหน้าวิชาและรายงาน
        </p>
        {state.fieldErrors?.creditHours && (
          <p className="mt-1 text-xs text-red-700">
            {state.fieldErrors.creditHours}
          </p>
        )}
      </div>

      {/* Advanced: subject code */}
      <div className="card p-5">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm font-medium text-ink-soft hover:text-ink"
        >
          {showAdvanced ? "▾" : "▸"} ตัวเลือกเพิ่มเติม
        </button>
        {showAdvanced && (
          <div className="mt-4">
            <label
              htmlFor="subjectCode"
              className="mb-1.5 block text-sm font-medium"
            >
              รหัสวิชา (ไม่บังคับ)
            </label>
            <input
              id="subjectCode"
              name="subjectCode"
              type="text"
              maxLength={20}
              className="input"
              placeholder="เช่น MATH-M4 หรือ ค31101"
            />
            <p className="mt-1.5 text-xs text-ink-soft">
              สำหรับ transcript / รายงาน — กรอกถ้ามีรหัสมาตรฐานของโรงเรียน
            </p>
            {state.fieldErrors?.subjectCode && (
              <p className="mt-1 text-xs text-red-700">
                {state.fieldErrors.subjectCode}
              </p>
            )}
          </div>
        )}
      </div>

      {/* red-200 is not in the theme scale, so it stayed Tailwind's default
          pink in every mode — a bright edge around the dark error box. */}
      {state.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700">
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
