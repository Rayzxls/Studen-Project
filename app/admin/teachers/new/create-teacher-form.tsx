"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, UserPlus } from "lucide-react";
import { type CreateTeacherState } from "@/lib/admin/teacher-created-flash";
import { createTeacherAction } from "../actions";

const INITIAL_STATE: CreateTeacherState = {};

export function CreateTeacherForm() {
  const [state, action] = useActionState(createTeacherAction, INITIAL_STATE);

  return (
    <form action={action} className="card space-y-5 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5 text-sm font-medium text-black/70">
          ชื่อ
          <input
            name="firstName"
            required
            autoComplete="given-name"
            className="input"
            placeholder="เช่น สมชาย"
          />
          {state.fieldErrors?.firstName && (
            <FieldError>{state.fieldErrors.firstName}</FieldError>
          )}
        </label>
        <label className="space-y-1.5 text-sm font-medium text-black/70">
          นามสกุล
          <input
            name="lastName"
            required
            autoComplete="family-name"
            className="input"
            placeholder="เช่น ใจดี"
          />
          {state.fieldErrors?.lastName && (
            <FieldError>{state.fieldErrors.lastName}</FieldError>
          )}
        </label>
      </div>

      <label className="block space-y-1.5 text-sm font-medium text-black/70">
        อีเมล
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="teacher@school.ac.th"
        />
        {state.fieldErrors?.email && (
          <FieldError>{state.fieldErrors.email}</FieldError>
        )}
      </label>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-800">
        ระบบจะสร้างรหัสผ่านชั่วคราวให้ครูอัตโนมัติ
        และครูจะถูกบังคับให้เปลี่ยนรหัสผ่านตอนเข้าสู่ระบบครั้งแรก
      </div>

      {state.error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {translateError(state.error)}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full justify-center md:w-auto"
    >
      <UserPlus className="h-4 w-4" />
      {pending ? "กำลังเพิ่มครู..." : "เพิ่มครูรายคน"}
    </button>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-normal text-red-700">{children}</p>;
}

function translateError(code: string): string {
  switch (code) {
    case "email_exists":
      return "อีเมลนี้มีผู้ใช้อยู่แล้ว";
    case "not_admin":
      return "เฉพาะ Admin เท่านั้น";
    default:
      return code;
  }
}
