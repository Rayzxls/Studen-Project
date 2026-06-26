import Link from "next/link";
import {
  ArrowLeft,
  GraduationCap,
  KeyRound,
  Presentation,
  ShieldCheck,
} from "lucide-react";

/**
 * /reset-password — account recovery guidance (ADR-0026).
 *
 * The product deliberately has NO email-based self-service reset: recovery
 * runs through an admin who generates a one-time temporary password and
 * relays it out-of-band (LINE / SMS / note), after which the user is forced
 * to set their own password on next login (the /reset-password/force flow).
 * This page is the role-aware "who do I contact" surface for that model —
 * not a form, by design. See ADR-0026 § 2.
 */

const CONTACTS = [
  {
    role: "นักเรียน",
    Icon: GraduationCap,
    detail:
      "แจ้งครูประจำชั้นหรือครูประจำวิชา เพื่อให้ติดต่อผู้ดูแลระบบรีเซ็ตรหัสผ่านให้",
  },
  {
    role: "ครู",
    Icon: Presentation,
    detail: "ติดต่อผู้ดูแลระบบ (Admin) ของโรงเรียนเพื่อขอรหัสผ่านชั่วคราว",
  },
  {
    role: "ผู้ดูแลระบบ",
    Icon: ShieldCheck,
    detail:
      "ให้ผู้ดูแลระบบอีกคนรีเซ็ตให้ — หากมีแอดมินคนเดียว ใช้การกู้สิทธิ์ผ่านระบบ (เข้าถึงฐานข้อมูลโดยตรง)",
  },
] as const;

const STEPS = [
  "เข้าสู่ระบบด้วยรหัสผ่านชั่วคราวที่ได้รับ",
  "ระบบจะให้คุณตั้งรหัสผ่านใหม่ของตัวเองทันที",
] as const;

export default function ResetPasswordPage() {
  return (
    <div className="animate-fade-in rounded-2xl bg-white p-8 shadow-card">
      {/* Header */}
      <div className="flex items-start gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"
          aria-hidden="true"
        >
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1
            className="text-2xl font-medium text-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            ลืมรหัสผ่าน?
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-black/60">
            กู้รหัสผ่านได้โดยให้ผู้ดูแลระบบออกรหัสผ่านชั่วคราวให้ —
            เพื่อความปลอดภัย ระบบจะไม่ส่งรหัสผ่านทางอีเมล
          </p>
        </div>
      </div>

      {/* Who to contact */}
      <section className="mt-7" aria-labelledby="contact-heading">
        <h2
          id="contact-heading"
          className="text-xs font-semibold uppercase tracking-wide text-black/45"
        >
          ติดต่อใครดี?
        </h2>
        <ul className="mt-3 space-y-2.5">
          {CONTACTS.map(({ role, Icon, detail }) => (
            <li
              key={role}
              className="flex items-start gap-3 rounded-xl border border-black/[0.06] bg-black/[0.015] p-3.5"
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600"
                aria-hidden="true"
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-black">{role}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-black/60">
                  {detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* After you receive a temp password */}
      <section className="mt-6" aria-labelledby="steps-heading">
        <h2
          id="steps-heading"
          className="text-xs font-semibold uppercase tracking-wide text-black/45"
        >
          เมื่อได้รหัสผ่านชั่วคราวแล้ว
        </h2>
        <ol className="mt-3 space-y-3">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <p className="pt-0.5 text-sm leading-relaxed text-black/70">
                {step}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <Link
        href="/login"
        className="btn-ghost mt-7 w-full justify-center gap-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        กลับหน้าเข้าสู่ระบบ
      </Link>
    </div>
  );
}
