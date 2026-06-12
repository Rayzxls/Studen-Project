"use client";

import { useActionState, useState } from "react";
import { createCourseAction, type CreateCourseState } from "./actions";

interface FormProps {
  terms: { id: string; name: string; number: number; isActive: boolean }[];
}

const initial: CreateCourseState = {};

export function CreateCourseForm({ terms }: FormProps) {
  const [state, action, pending] = useActionState(createCourseAction, initial);
  const defaultTerm = terms.find((t) => t.isActive)?.id ?? terms[0]?.id ?? "";
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

      {/* Class identity + Term */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="gradeLevel"
                className="mb-1.5 block text-sm font-medium"
              >
                ระดับชั้น
              </label>
              <input
                id="gradeLevel"
                name="gradeLevel"
                type="text"
                required
                maxLength={20}
                className="input"
                placeholder="เช่น ม.4"
              />
              {state.fieldErrors?.gradeLevel && (
                <p className="mt-1 text-xs text-red-700">
                  {state.fieldErrors.gradeLevel}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="roomName"
                className="mb-1.5 block text-sm font-medium"
              >
                ห้อง
              </label>
              <input
                id="roomName"
                name="roomName"
                type="text"
                required
                maxLength={40}
                className="input"
                placeholder="เช่น 3"
              />
              {state.fieldErrors?.roomName && (
                <p className="mt-1 text-xs text-red-700">
                  {state.fieldErrors.roomName}
                </p>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            ระบบจะสร้างหรือใช้ห้องเดิมให้อัตโนมัติ เช่น ม.4 + ห้อง 3 = ม.4/3
          </p>
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
            <p className="mt-1 text-xs text-red-700">
              {state.fieldErrors.termId}
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
          required
          defaultValue="1.5"
          className="input"
        />
        <p className="mt-1.5 text-xs text-ink-soft">
          หน่วยกิตตามโครงสร้างหลักสูตรของโรงเรียน
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

      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
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
