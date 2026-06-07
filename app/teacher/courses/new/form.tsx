"use client";

import { useActionState, useState } from "react";
import { ClassPicker, type ClassOption } from "@/components/class-picker";
import { createCourseAction, type CreateCourseState } from "./actions";

interface FormProps {
  classes: ClassOption[];
  terms: { id: string; name: string; number: number; isActive: boolean }[];
  recentClassIds: string[];
  homeroomClassId: string | null;
}

const initial: CreateCourseState = {};

export function CreateCourseForm({
  classes,
  terms,
  recentClassIds,
  homeroomClassId,
}: FormProps) {
  const [state, action, pending] = useActionState(createCourseAction, initial);
  const defaultTerm = terms.find((t) => t.isActive)?.id ?? terms[0]?.id ?? "";
  const [classId, setClassId] = useState("");
  const selectedClass = classes.find((c) => c.id === classId);
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

      {/* Class + Term */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <label htmlFor="classId" className="mb-1.5 block text-sm font-medium">
            ห้องเรียน
          </label>
          <ClassPicker
            classes={classes}
            recentClassIds={recentClassIds}
            homeroomClassId={homeroomClassId}
            value={classId}
            onChange={setClassId}
            inputName="classId"
          />
          {state.fieldErrors?.classId && (
            <p className="mt-1 text-xs text-red-700">
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
            <p className="mt-1 text-xs text-red-700">
              {state.fieldErrors.termId}
            </p>
          )}
        </div>
      </div>

      {/* Credit + Grade level (Grade level auto-suggests from class) */}
      <div className="grid gap-4 md:grid-cols-2">
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
            ใช้คำนวณเกรดเฉลี่ยรวมเทอม (ตามมาตรฐานโรงเรียน)
          </p>
          {state.fieldErrors?.creditHours && (
            <p className="mt-1 text-xs text-red-700">
              {state.fieldErrors.creditHours}
            </p>
          )}
        </div>

        <div className="card p-5">
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
            defaultValue={selectedClass?.gradeLevel ?? ""}
            key={selectedClass?.gradeLevel}
          />
          {state.fieldErrors?.gradeLevel && (
            <p className="mt-1 text-xs text-red-700">
              {state.fieldErrors.gradeLevel}
            </p>
          )}
        </div>
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
